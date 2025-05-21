import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc721Abi } from "../../../../../constants/abis/erc721";
import { TransactionService } from "../../../../../services/transaction.service";
import { logRequest, logStep, logError } from '../../../../../utils/loggingUtils';

type ERC721MintRequestBody = {
    to: string;
    tokenId: string;
    options?: {
        waitForReceipt?: boolean;
        confirmations?: number;
    }
}

type ERC721MintRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC721MintResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC721MintSchema = {
    tags: ['ERC721'],
    body: {
        type: 'object',
        required: ['to', 'tokenId'],
        properties: {
            to: { type: 'string' },
            tokenId: { type: 'string' },
            options: {
                type: 'object',
                properties: {
                    waitForReceipt: { type: 'boolean' }
                }
            }
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

export async function erc721Mint(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721MintRequestParams;
        Body: ERC721MintRequestBody;
        Reply: ERC721MintResponse;
    }>('/write/erc721/:chainId/:contractAddress/mint', {
        schema: ERC721MintSchema
    }, async (request, reply) => {
        logRequest(request);
        try {
            const { to, tokenId, options } = request.body;
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
                'mint',
                [to, tokenId]
            );
            logStep(request, 'Function data encoded');

            const tx = {
                to: contractAddress,
                data
            };

            const txService = new TransactionService(fastify);

            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "mint", args: [to, tokenId] } });
            logStep(request, 'Adding pending transaction in db', { pendingTx });

            logStep(request, 'Sending transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'Transaction sent', { txResponse });

            if (options?.waitForReceipt) {
                logStep(request, 'Waiting for transaction receipt', { txHash: txResponse.hash });
                const receipt = await txResponse.wait(options.confirmations ?? 1);
                logStep(request, 'Transaction receipt received', { receipt });
            }

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
            logError(request, error, {
                params: request.params,
                body: request.body
            });
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
