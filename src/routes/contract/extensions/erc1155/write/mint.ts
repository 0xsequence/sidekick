import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { TransactionService } from "../../../../../services/transaction.service";
import { erc1155Abi } from "../../../../../constants/abis/erc1155";
import { logRequest, logStep } from "../../../../../utils/loggingUtils";

type ERC1155MintRequestBody = {
    recipient: string;
    id: string;
    amount: string;
    data: string;
}

type ERC1155MintRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC1155MintResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC1155MintSchema = {
    tags: ['ERC1155'],
    body: {
        type: 'object',
        required: ['recipient', 'id', 'amount', 'data'],
        properties: {
            recipient: { type: 'string' },
            id: { type: 'string' },
            amount: { type: 'string' },
            data: { type: 'string' }
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
        },
        500: {
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        txHash: { type: 'string', nullable: true },
                        txUrl: { type: 'string', nullable: true },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }
}

export async function erc1155Mint(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC1155MintRequestParams;
        Body: ERC1155MintRequestBody;
        Reply: ERC1155MintResponse;
    }>('/write/erc1155/:chainId/:contractAddress/mint', {
        schema: ERC1155MintSchema
    }, async (request, reply) => {
        try {
            logRequest(request);
            const { recipient, id, amount, data: mintData } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            const contract = new ethers.Contract(
                contractAddress,
                erc1155Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'mint',
                [recipient, id, amount, mintData]
            );

            const tx = {
                to: contractAddress,
                data
            }

            logStep(request, 'Tx prepared', { tx });

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "mint", args: [recipient, id, amount, mintData] } });
            logStep(request, 'Added pending transaction in db');

            logStep(request, 'Sending transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'Transaction sent', { txResponse });

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);
            logStep(request, 'Transaction status updated in db');

            logStep(request, 'Mint transaction success', { txHash: txResponse.hash });
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
                    error: error instanceof Error ? error.message : 'Failed to mint NFT'
                }
            });
        }
    });
}
