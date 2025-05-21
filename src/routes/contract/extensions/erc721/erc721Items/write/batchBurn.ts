import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import { encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { erc721ItemsAbi } from "../../../../../../constants/abis/erc721Items";
import { logRequest, logStep, logError } from '../../../../../../utils/loggingUtils';

type ERC721ItemsBatchBurnRequestBody = {
    tokenIds: string[]; 
};

type ERC721ItemsBatchBurnRequestParams = {
    chainId: string;
    contractAddress: string;
};

type ERC721ItemsBatchBurnResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
};

const ERC721ItemsBatchBurnSchema = {
    tags: ['ERC721Items'],
    description: 'Burns multiple tokens on an ERC721Items contract in a single transaction.',
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
        required: ['tokenIds'],
        properties: {
            tokenIds: { 
                type: 'array', 
                items: { type: 'string' }, 
                description: 'An array of token IDs to burn.'
            },
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

export async function erc721ItemsBatchBurn(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721ItemsBatchBurnRequestParams;
        Body: ERC721ItemsBatchBurnRequestBody;
        Reply: ERC721ItemsBatchBurnResponse;
    }>(
        '/write/erc721Items/:chainId/:contractAddress/batchBurn',
        {
            schema: ERC721ItemsBatchBurnSchema,
        },
        async (request, reply) => {
            logRequest(request);
            try {
                const { chainId, contractAddress } = request.params;
                const { tokenIds } = request.body;

                const signer = await getSigner(chainId);
                if (!signer || !signer.account?.address) {
                    logError(request, new Error('Signer not configured correctly.'), { signer });
                    throw new Error('Signer not configured correctly.');
                }
                logStep(request, 'Tx signer received', { signer: signer.account.address });
                const txService = new TransactionService(fastify);

                const batchBurnData = encodeFunctionData({
                    abi: erc721ItemsAbi,
                    functionName: 'batchBurn',
                    args: [tokenIds.map(id => BigInt(id))],
                });
                logStep(request, 'Function data encoded', { tokenIds });

                logStep(request, 'Sending batchBurn transaction...');
                const txResponse = await signer.sendTransaction({
                    to: contractAddress,
                    data: batchBurnData,
                });
                logStep(request, 'BatchBurn transaction sent', { txResponse });

                const receipt = await txResponse.wait();
                logStep(request, 'BatchBurn transaction mined', { receipt });

                if (receipt?.status === 0) {
                    logError(request, new Error('BatchBurn transaction reverted'), { receipt });
                    throw new Error('BatchBurn transaction reverted');
                }

                await txService.createTransaction({
                    chainId,
                    contractAddress,
                    abi: erc721ItemsAbi,
                    data: batchBurnData,
                    txHash: receipt?.hash ?? '',
                    functionName: 'batchBurn',
                    args: tokenIds,
                    isDeployTx: false,
                });
                logStep(request, 'Transaction record created in db');

                logStep(request, 'BatchBurn transaction success', { txHash: receipt?.hash });
                return reply.code(200).send({
                    result: {
                        txHash: receipt?.hash ?? null,
                        txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
                    },
                });
            } catch (error) {
                logError(request, error, {
                    params: request.params,
                    body: request.body
                });
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during batchBurn';
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