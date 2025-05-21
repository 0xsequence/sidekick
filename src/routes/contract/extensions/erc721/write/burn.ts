import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc721Abi } from "../../../../../constants/abis/erc721";
import { TransactionService } from "../../../../../services/transaction.service";
import { logRequest, logStep } from "../../../../../utils/loggingUtils";

type ERC721BurnRequestBody = {
    tokenId: string;
}

type ERC721BurnRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC721BurnResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC721BurnSchema = {
    tags: ['ERC721'],
    body: {
        type: 'object',
        required: ['tokenId'],
        properties: {
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
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function erc721Burn(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721BurnRequestParams;
        Body: ERC721BurnRequestBody;
        Reply: ERC721BurnResponse;
    }>('/write/erc721/:chainId/:contractAddress/burn', {
        schema: ERC721BurnSchema
    }, async (request, reply) => {
        logRequest(request);
        
        try {
            const { tokenId } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            const contract = new ethers.Contract(
                contractAddress,
                erc721Abi,
                signer
            );
            logStep(request, 'Contract instance created');

            const data = contract.interface.encodeFunctionData(
                'burn',
                [tokenId]
            );
            logStep(request, 'Function data encoded');

            const tx = {
                to: contractAddress,
                data
            }

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "burn", args: [tokenId] } });
            logStep(request, 'Adding pending transaction in db', { pendingTx });

            logStep(request, 'Sending transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'Transaction sent', { txResponse });

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);
            logStep(request, 'Transaction status updated in db', { txResponse });

            logStep(request, 'Transaction success', { txResponse });
            return reply.code(200).send({
                result: {
                    txHash: txResponse.hash,
                    txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash)
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    error: error instanceof Error ? error.message : 'Failed to burn NFT'
                }
            });
        }
    });
}
