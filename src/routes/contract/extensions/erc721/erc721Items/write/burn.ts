import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import { encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { erc721ItemsAbi } from "../../../../../../constants/abis/erc721Items";

type ERC721ItemsBurnRequestBody = {
    tokenId: string;
};

type ERC721ItemsBurnRequestParams = {
    chainId: string;
    contractAddress: string;
};

type ERC721ItemsBurnResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
};

const ERC721ItemsBurnSchema = {
    tags: ['ERC721Items'],
    description: 'Burns a specific token on an ERC721Items contract.',
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
        required: ['tokenId'],
        properties: {
            tokenId: { type: 'string', description: 'The ID of the token to burn.' },
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

export async function erc721ItemsBurn(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721ItemsBurnRequestParams;
        Body: ERC721ItemsBurnRequestBody;
        Reply: ERC721ItemsBurnResponse;
    }>(
        '/write/erc721Items/:chainId/:contractAddress/burn',
        {
            schema: ERC721ItemsBurnSchema,
        },
        async (request, reply) => {
            try {
                const { chainId, contractAddress } = request.params;
                const { tokenId } = request.body;

                const signer = await getSigner(chainId);
                if (!signer || !signer.account?.address) {
                    request.log.error('Signer account or address is null or undefined.');
                    throw new Error('Signer not configured correctly.');
                }
                const txService = new TransactionService(fastify);

                const burnData = encodeFunctionData({
                    abi: erc721ItemsAbi,
                    functionName: 'burn',
                    args: [BigInt(tokenId)],
                });

                request.log.info(`Sending burn transaction for token ${tokenId} to ${contractAddress} on chain ${chainId}`);
                const txResponse = await signer.sendTransaction({
                    to: contractAddress,
                    data: burnData,
                });
                request.log.info(`Burn transaction sent: ${txResponse.hash}`);

                const receipt = await txResponse.wait();
                request.log.info(`Burn transaction mined: ${receipt?.hash}, status: ${receipt?.status}`);

                if (receipt?.status === 0) {
                    request.log.error(`Burn transaction reverted: ${receipt?.hash}`);
                    throw new Error('Burn transaction reverted');
                }

                await txService.createTransaction({
                    chainId,
                    contractAddress,
                    abi: erc721ItemsAbi,
                    data: burnData,
                    txHash: receipt?.hash ?? '',
                    functionName: 'burn',
                    args: [tokenId],
                    isDeployTx: false,
                });

                return reply.code(200).send({
                    result: {
                        txHash: receipt?.hash ?? null,
                        txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
                    },
                });
            } catch (error) {
                request.log.error(error, 'Failed to burn token on ERC721Items contract');
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
