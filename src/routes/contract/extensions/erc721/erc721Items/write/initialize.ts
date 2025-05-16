import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import { encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { erc721ItemsAbi } from "../../../../../../constants/abis/erc721Items";

type ERC721ItemsInitializeRequestBody = {
    owner: string;
    tokenName: string;
    tokenSymbol: string;
    tokenBaseURI: string;
    tokenContractURI: string;
    royaltyReceiver: string;
    royaltyFeeNumerator: string;
};

type ERC721ItemsInitializeRequestParams = {
    chainId: string;
    contractAddress: string;
};

type ERC721ItemsInitializeResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
};

const ERC721ItemsInitializeSchema = {
    tags: ['ERC721Items'],
    description: 'Calls the initialize function on an ERC721Items contract.',
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
            'tokenSymbol',
            'tokenBaseURI',
            'tokenContractURI',
            'royaltyReceiver',
            'royaltyFeeNumerator',
        ],
        properties: {
            owner: { type: 'string', description: 'Address of the contract owner' },
            tokenName: { type: 'string', description: 'Name of the token' },
            tokenSymbol: { type: 'string', description: 'Symbol of the token' },
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

export async function erc721ItemsInitialize(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721ItemsInitializeRequestParams;
        Body: ERC721ItemsInitializeRequestBody;
        Reply: ERC721ItemsInitializeResponse;
    }>(
        '/write/erc721Items/:chainId/:contractAddress/initialize',
        {
            schema: ERC721ItemsInitializeSchema,
        },
        async (request, reply) => {
            try {
                const { chainId, contractAddress } = request.params;
                const {
                    owner,
                    tokenName,
                    tokenSymbol,
                    tokenBaseURI,
                    tokenContractURI,
                    royaltyReceiver,
                    royaltyFeeNumerator,
                } = request.body;

                const signer = await getSigner(chainId);
                 if (!signer || !signer.account?.address) {
                    request.log.error('Signer account or address is null or undefined.');
                    throw new Error('Signer not configured correctly.');
                }
                const txService = new TransactionService(fastify);

                const initializeData = encodeFunctionData({
                    abi: erc721ItemsAbi,
                    functionName: 'initialize',
                    args: [
                        owner,
                        tokenName,
                        tokenSymbol,
                        tokenBaseURI,
                        tokenContractURI,
                        royaltyReceiver,
                        BigInt(royaltyFeeNumerator),
                    ],
                });

                request.log.info(`Sending initialize transaction to ${contractAddress} on chain ${chainId}`);
                const txResponse = await signer.sendTransaction({
                    to: contractAddress,
                    data: initializeData,
                });
                request.log.info(`Initialize transaction sent: ${txResponse.hash}`);

                const receipt = await txResponse.wait();
                request.log.info(`Initialize transaction mined: ${receipt?.hash}, status: ${receipt?.status}`);

                if (receipt?.status === 0) {
                    request.log.error(`Initialize transaction reverted: ${receipt?.hash}`);
                    throw new Error('Initialize transaction reverted');
                }

                await txService.createTransaction({
                    chainId,
                    contractAddress,
                    abi: erc721ItemsAbi,
                    data: initializeData,
                    txHash: receipt?.hash ?? '',
                    functionName: 'initialize',
                    args: [owner, tokenName, tokenSymbol, tokenBaseURI, tokenContractURI, royaltyReceiver, royaltyFeeNumerator],
                    isDeployTx: false,
                });

                return reply.code(200).send({
                    result: {
                        txHash: receipt?.hash ?? null,
                        txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
                    },
                });
            } catch (error) {
                request.log.error(error, 'Failed to initialize ERC721Items contract');
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