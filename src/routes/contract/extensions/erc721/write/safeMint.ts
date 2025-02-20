import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc721Abi } from "../../../../../constants/abis/erc721";
import { TransactionService } from "../../../../../services/transaction.service";

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
        error?: string;
    };
}

const ERC721SafeMintSchema = {
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
        try {
            const { to, tokenId } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc721Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'safeMint',
                [to, tokenId]
            );

            const tx = {
                to: contractAddress,
                data
            }

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "safeMint", args: [to, tokenId] } });

            const txResponse: TransactionResponse = await signer.sendTransaction(tx);

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
