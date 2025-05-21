import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import { encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { erc1155ItemsAbi } from "../../../../../../constants/abis/erc1155Items";
import { logRequest, logStep, logError } from '../../../../../../utils/loggingUtils';

type ERC1155ItemsInitializeRequestBody = {
    owner: string;
    tokenName: string;
    tokenBaseURI: string;
    tokenContractURI: string;
    royaltyReceiver: string;
    royaltyFeeNumerator: string;
};

type ERC1155ItemsInitializeRequestParams = {
    chainId: string;
    contractAddress: string;
};

type ERC1155ItemsInitializeResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
};

const ERC1155ItemsInitializeSchema = {
    tags: ['ERC1155Items'],
    description: 'Calls the initialize function on an ERC1155Items contract.',
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
        required: [
            'owner',
            'tokenName',
            'tokenBaseURI',
            'tokenContractURI',
            'royaltyReceiver',
            'royaltyFeeNumerator',
        ],
        properties: {
            owner: { type: 'string', description: 'Address of the contract owner' },
            tokenName: { type: 'string', description: 'Name of the token' },
            tokenBaseURI: { type: 'string', description: 'Base URI for token metadata' },
            tokenContractURI: { type: 'string', description: 'Contract URI for collection metadata' },
            royaltyReceiver: { type: 'string', description: 'Address to receive royalties' },
            royaltyFeeNumerator: { type: 'string', description: 'Royalty fee numerator (e.g., 500 for 5%)' },
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
        400: {
            type: 'object',
            properties: {
                error: { type: 'string' },
            },
        },
        500: {
            type: 'object',
            properties: {
                error: { type: 'string' },
            },
        },
    },
};

export async function erc1155ItemsInitialize(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC1155ItemsInitializeRequestParams;
        Body: ERC1155ItemsInitializeRequestBody;
        Reply: ERC1155ItemsInitializeResponse;
    }>(
        '/write/erc1155Items/:chainId/:contractAddress/initialize',
        {
            schema: ERC1155ItemsInitializeSchema,
        },
        async (request, reply) => {
            logRequest(request);
            try {
                const { chainId, contractAddress } = request.params;
                const {
                    owner,
                    tokenName,
                    tokenBaseURI,
                    tokenContractURI,
                    royaltyReceiver,
                    royaltyFeeNumerator,
                } = request.body;

                const signer = await getSigner(chainId);
                if (!signer || !signer.account?.address) {
                    logError(request, new Error('Signer not configured correctly.'), { signer });
                    throw new Error('Signer not configured correctly.');
                }
                logStep(request, 'Tx signer received', { signer: signer.account.address });
                const txService = new TransactionService(fastify);

                const initializeData = encodeFunctionData({
                    abi: erc1155ItemsAbi as Abi,
                    functionName: 'initialize',
                    args: [
                        owner,
                        tokenName,
                        tokenBaseURI,
                        tokenContractURI,
                        royaltyReceiver,
                        BigInt(royaltyFeeNumerator),
                    ],
                });
                logStep(request, 'Function data encoded', { owner, tokenName, tokenBaseURI, tokenContractURI, royaltyReceiver, royaltyFeeNumerator });

                logStep(request, 'Sending initialize transaction...', { contractAddress, chainId });
                const txResponse = await signer.sendTransaction({
                    to: contractAddress,
                    data: initializeData,
                });
                logStep(request, 'Initialize transaction sent', { txHash: txResponse.hash });

                const receipt = await txResponse.wait();
                logStep(request, 'Initialize transaction mined', { txHash: receipt?.hash, status: receipt?.status });

                if (receipt?.status === 0) {
                    logError(request, new Error('Initialize transaction reverted'), { txHash: receipt?.hash });
                    throw new Error('Initialize transaction reverted');
                }

                await txService.createTransaction({
                    chainId,
                    contractAddress,
                    abi: erc1155ItemsAbi,
                    data: initializeData,
                    txHash: receipt?.hash ?? '',
                    functionName: 'initialize',
                    args: [owner, tokenName, tokenBaseURI, tokenContractURI, royaltyReceiver, royaltyFeeNumerator],
                    isDeployTx: false,
                });
                logStep(request, 'Transaction saved in db', { txHash: receipt?.hash });

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
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during initialization';
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