import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData, encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../utils/other";
import { erc721ItemsBytecode } from "../../../constants/bytecodes/erc721Items";
import { erc721ItemsAbi } from "../../../constants/abis/erc721Items";
import { ethers, type TransactionReceipt, type TransactionResponse } from "ethers";


type ERC721ItemsDeployRequestBody = {
    owner: string;
    tokenName: string;
    tokenSymbol: string;
    tokenBaseURI: string;
    tokenContractURI: string;
    royaltyReceiver: string;
    royaltyFeeNumerator: string; 
};

type ERC721ItemsDeployRequestParams = {
    chainId: string;
};

type ERC721ItemsDeployResponse = {
    result?: {
        deploymentTxHash?: string | null;
        deploymentTxUrl?: string | null;
        initializationTxHash: string | null;
        initializationTxUrl: string | null;
        contractAddress: string | null;
        error?: string;
    };
};

const ERC721ItemsDeploySchema = {
    tags: ['ERC721Items', 'Deploy'],
    description: 'Deploy an Upgradable ERC721Items contract and call its initialize function.',
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
    params: {
        type: 'object',
        required: ['chainId'],
        properties: {
            chainId: { type: 'string' },
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
                        deploymentTxHash: { type: 'string', nullable: true },
                        deploymentTxUrl: { type: 'string', nullable: true },
                        initializationTxHash: { type: 'string' },
                        initializationTxUrl: { type: 'string' },
                        contractAddress: { type: 'string' },
                        error: { type: 'string', nullable: true },
                    },
                },
            },
        },
    },
};

export async function erc721ItemsDeploy(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721ItemsDeployRequestParams;
        Body: ERC721ItemsDeployRequestBody;
        Reply: ERC721ItemsDeployResponse;
    }>(
        '/deploy/erc721Items/:chainId',
        {
            schema: ERC721ItemsDeploySchema,
        },
        async (request, reply) => {
            try {
                const { chainId } = request.params;
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
                const txService = new TransactionService(fastify);

                // Step 1: Deploy the contract
                const deployData = encodeDeployData({
                    abi: erc721ItemsAbi,
                    bytecode: erc721ItemsBytecode as `0x${string}`,
                    args: [],
                });

                request.log.info(`ERC721Items sending deployment transaction`);
                const deployTx: TransactionResponse = await signer.sendTransaction({
                    data: deployData
                });

                const deployReceipt: TransactionReceipt | null = await deployTx.wait();

                const contractCreatedEvent = deployReceipt?.logs.find(log =>
                    log.topics.includes(ethers.id('CreatedContract(address)'))
                )

                const deployedContractAddress = ethers.getAddress(
                    ethers.zeroPadValue(ethers.stripZerosLeft(contractCreatedEvent?.data ?? ''), 20)
                )

                if (deployReceipt?.status === 0) {
                    request.log.error(`ERC721Items deployment transaction reverted: ${deployReceipt?.hash}`);
                    throw new Error('Contract deployment transaction reverted');
                }

                if (!deployedContractAddress) {
                    request.log.error('Contract address not found after deployment');
                    throw new Error('Contract address not found after deployment');
                }
                request.log.info(`ERC721Items contract deployed at: ${deployedContractAddress}`);


                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress,
                    abi: erc721ItemsAbi,
                    data: deployData,
                    txHash: deployReceipt?.hash ?? '',
                    isDeployTx: true,
                });

                // Step 2: Initialize the contract
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
                        BigInt(royaltyFeeNumerator), // Convert string to BigInt for uint96
                    ],
                });

                const initializeTx = await signer.sendTransaction({
                    to: deployedContractAddress,
                    data: initializeData,
                });
                
                request.log.info(`ERC721Items initialization transaction sent: ${initializeTx.hash} to contract: ${deployedContractAddress}`);
                const initializeReceipt = await initializeTx.wait();
                request.log.info(`ERC721Items initialization transaction mined: ${initializeReceipt?.hash}`);


                if (initializeReceipt?.status === 0) {
                     request.log.error(`ERC721Items initialization transaction reverted: ${initializeReceipt?.hash}`);
                    throw new Error('Contract initialization transaction reverted');
                }

                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress,
                    abi: erc721ItemsAbi,
                    data: initializeData,
                    txHash: initializeReceipt?.hash ?? '',
                    isDeployTx: false, 
                });

                return reply.code(200).send({
                    result: {
                        deploymentTxHash: deployReceipt?.hash ?? null,
                        deploymentTxUrl: getBlockExplorerUrl(Number(chainId), deployReceipt?.hash ?? ''),
                        initializationTxHash: initializeReceipt?.hash ?? null,
                        initializationTxUrl: getBlockExplorerUrl(Number(chainId), initializeReceipt?.hash ?? ''),
                        contractAddress: deployedContractAddress,
                    },
                });
            } catch (error) {
                request.log.error(error, 'Failed to deploy and initialize ERC721Items contract');
                return reply.code(500).send({
                    result: {
                        deploymentTxHash: null,
                        deploymentTxUrl: null,
                        initializationTxHash: null,
                        initializationTxUrl: null,
                        contractAddress: null,
                        error: error instanceof Error ? error.message : 'Failed to deploy and initialize ERC721Items contract',
                    },
                });
            }
        }
    );
}
