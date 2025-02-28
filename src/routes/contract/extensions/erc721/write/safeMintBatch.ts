import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc721Abi } from "../../../../../constants/abis/erc721";
import { TransactionService } from "../../../../../services/transaction.service";

type ERC721SafeMintBatchRequestBody = {
    recipients: string[];
    tokenIds: string[];
}

type ERC721SafeMintBatchRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC721SafeMintBatchResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC721SafeMintBatchSchema = {
    tags: ['ERC721'],
    body: {
        type: 'object',
        required: ['recipients', 'tokenIds'],
        properties: {
            recipients: { type: 'array', items: { type: 'string' } },
            tokenIds: { type: 'array', items: { type: 'string' } }
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

export async function erc721SafeMintBatch(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721SafeMintBatchRequestParams;
        Body: ERC721SafeMintBatchRequestBody;
        Reply: ERC721SafeMintBatchResponse;
    }>('/write/erc721/:chainId/:contractAddress/safeMintBatch', {
        schema: ERC721SafeMintBatchSchema
    }, async (request, reply) => {
        try {
            const { recipients, tokenIds } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc721Abi,
                signer
            );

            const txs = recipients.map((recipient, index) => {
                const data = contract.interface.encodeFunctionData(
                    'safeMint',
                    [recipient, tokenIds[index]]
                );
                return {
                    to: contractAddress,
                    data
                }
            })

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "safeMintBatch", args: [] } });

            const txResponse: TransactionResponse = await signer.sendTransaction(txs);

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);

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
