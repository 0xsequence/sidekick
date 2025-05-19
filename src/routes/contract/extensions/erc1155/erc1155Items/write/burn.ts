import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { TransactionService } from "../../../../../../services/transaction.service";
import { erc1155ItemsAbi } from "../../../../../../constants/abis/erc1155Items";

type ERC1155ItemsBurnRequestBody = {
    tokenId: string;
    amount: string;
};

type ERC1155ItemsBurnRequestParams = {
    chainId: string;
    contractAddress: string;
};

type ERC1155ItemsBurnResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
};

const ERC1155ItemsBurnSchema = {
    tags: ['ERC1155Items'],
    description: 'Burns a specific token on an ERC1155Items contract.',
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' },
        },
    },
    body: {
        type: 'object',
        required: ['tokenId', 'amount'],
        properties: {
            tokenId: { type: 'string', description: 'The ID of the token to burn.' },
            amount: { type: 'string' }
        },
    },
    headers: {
        type: 'object',
        required: ['x-secret-key'],
        properties: {
            'x-secret-key': { type: 'string' },
        },
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
                        error: { type: 'string', nullable: true },
                    },
                },
            },
        },
    },
};

export async function erc1155ItemsBurn(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC1155ItemsBurnRequestParams;
        Body: ERC1155ItemsBurnRequestBody;
        Reply: ERC1155ItemsBurnResponse;
    }>(
        '/write/erc1155Items/:chainId/:contractAddress/burn',
        {
            schema: ERC1155ItemsBurnSchema,
        },
        async (request, reply) => {
            try {
                const { tokenId, amount } = request.body;
                const { chainId, contractAddress } = request.params;

                const signer = await getSigner(chainId);
                const contract = new ethers.Contract(
                    contractAddress,
                    erc1155ItemsAbi,
                    signer
                );

                const callData = contract.interface.encodeFunctionData(
                    'burn',
                    [tokenId, amount]
                );

                const tx = {
                    to: contractAddress,
                    data: callData
                };

                const txService = new TransactionService(fastify);

                // Create pending transaction first
                const pendingTx = await txService.createPendingTransaction({
                    chainId,
                    contractAddress,
                    data: { functionName: 'burn', args: [tokenId, amount] }
                });

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
                request.log.error(error, 'Failed to burn token on ERC1155Items contract');
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during burn';
                return reply.code(500).send({
                    result: {
                        txHash: null,
                        txUrl: null,
                        error: errorMessage,
                    },
                });
            }
        }
    );
}
