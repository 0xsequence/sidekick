import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc721Abi } from "../../../../../constants/abis/erc721";
import { TransactionService } from "../../../../../services/transaction.service";
import { logRequest, logStep, logError } from '../../../../../utils/loggingUtils';
import { getTenderlySimulationUrl, prepareTransactionsForTenderlySimulation } from "../../../utils/tenderly/getSimulationUrl";

type ERC721SafeMintRequestBody = {
    to: string;
    tokenId: string;
}

type ERC721SafeMintRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC721SafeMintResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        txSimulationUrl?: string | null;
        error?: string;
    };
}

const ERC721SafeMintSchema = {
    tags: ['ERC721'],
    body: {
        type: 'object',
        required: ['to', 'tokenId'],
        properties: {
            to: { type: 'string' },
            tokenId: { type: 'string' }
        }
    },
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' },
        }
    },
    headers: {
        type: 'object',
        required: ['x-secret-key'],
        properties: {
            'x-secret-key': { type: 'string' },
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        txHash: { type: 'string' },
                        txUrl: { type: 'string' },
                        txSimulationUrl: { type: 'string', nullable: true },
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function erc721SafeMint(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721SafeMintRequestParams;
        Body: ERC721SafeMintRequestBody;
        Reply: ERC721SafeMintResponse;
    }>('/write/erc721/:chainId/:contractAddress/safeMint', {
        schema: ERC721SafeMintSchema
    }, async (request, reply) => {
        let tenderlyUrl: string | null = null;

        try {
            logRequest(request);

            const { to, tokenId } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            const contract = new ethers.Contract(
                contractAddress,
                erc721Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'safeMint',
                [to, tokenId]
            );
            logStep(request, 'Function data encoded');

            const tx = {
                to: contractAddress,
                data
            };

            const {simulationData, signedTx} = await prepareTransactionsForTenderlySimulation(signer, [tx], Number(chainId));
            let tenderlyUrl = getTenderlySimulationUrl({
                chainId: chainId,
                gas: 3000000,
                block: await signer.provider.getBlockNumber(),
                blockIndex: 0,
                contractAddress: signedTx.entrypoint,
                rawFunctionInput: simulationData
            });

            const txService = new TransactionService(fastify);

            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "safeMint", args: [to, tokenId] } });
            logStep(request, 'Pending transaction added in db');
            
            logStep(request, 'Sending transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'Transaction sent', { txResponse });

            logStep(request, 'Updating transaction status in db');
            await txService.updateTransactionStatus(pendingTx.id, txResponse);

            logStep(request, 'Transaction success', { txHash: txResponse.hash });
            return reply.code(200).send({
                result: {
                    txHash: txResponse.hash,
                    txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash),
                    txSimulationUrl: tenderlyUrl ?? null
                }
            });

        } catch (error) {
            logError(request, error, {
                params: request.params,
                body: request.body
            });
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    txSimulationUrl: tenderlyUrl ?? null,
                    error: error instanceof Error ? error.message : 'Failed to mint NFT'
                }
            });
        }
    });
}
