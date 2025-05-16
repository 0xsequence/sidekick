import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import { encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { erc721ItemsAbi } from "../../../../../../constants/abis/erc721Items";

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
            try {
                const { chainId, contractAddress } = request.params;
                const { tokenIds } = request.body;

                const signer = await getSigner(chainId);
                if (!signer || !signer.account?.address) {
                    request.log.error('Signer account or address is null or undefined.');
                    throw new Error('Signer not configured correctly.');
                }
                const txService = new TransactionService(fastify);

                const batchBurnData = encodeFunctionData({
                    abi: erc721ItemsAbi,
                    functionName: 'batchBurn',
                    args: [tokenIds.map(id => BigInt(id))],
                });

                request.log.info(`Sending batchBurn transaction for tokens ${tokenIds.join(', ')} to ${contractAddress} on chain ${chainId}`);
                const txResponse = await signer.sendTransaction({
                    to: contractAddress,
                    data: batchBurnData,
                });
                request.log.info(`BatchBurn transaction sent: ${txResponse.hash}`);

                const receipt = await txResponse.wait();
                request.log.info(`BatchBurn transaction mined: ${receipt?.hash}, status: ${receipt?.status}`);

                if (receipt?.status === 0) {
                    request.log.error(`BatchBurn transaction reverted: ${receipt?.hash}`);
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

                return reply.code(200).send({
                    result: {
                        txHash: receipt?.hash ?? null,
                        txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
                    },
                });
            } catch (error) {
                request.log.error(error, 'Failed to batchBurn tokens on ERC721Items contract');
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