import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData, encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../utils/other";
import { erc1155ItemsBytecode } from "../../../constants/bytecodes/erc1155Items";
import { erc1155ItemsAbi } from "../../../constants/abis/erc1155Items";
import { ethers, type TransactionReceipt, type TransactionResponse } from "ethers";

type ERC1155ItemsDeployRequestBody = {
    owner: string;
    tokenName: string;
    tokenBaseURI: string;
    tokenContractURI: string;
    royaltyReceiver: string;
    royaltyFeeNumerator: string;
};

type ERC1155ItemsDeployRequestParams = {
    chainId: string;
};

type ERC1155ItemsDeployResponse = {
    result?: {
        deploymentTxHash?: string | null;
        deploymentTxUrl?: string | null;
        initializationTxHash: string | null;
        initializationTxUrl: string | null;
        contractAddress: string | null;
        error?: string;
    };
};

const ERC1155ItemsDeploySchema = {
    tags: ['ERC1155Items', 'Deploy'],
    description: 'Deploy an Upgradable ERC1155Items contract and call its initialize function.',
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

export async function erc1155ItemsDeploy(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC1155ItemsDeployRequestParams;
        Body: ERC1155ItemsDeployRequestBody;
        Reply: ERC1155ItemsDeployResponse;
    }>(
        '/deploy/erc1155Items/:chainId',
        {
            schema: ERC1155ItemsDeploySchema,
        },
        async (request, reply) => {
            try {
                const { chainId } = request.params;
                const {
                    owner,
                    tokenName,
                    tokenBaseURI,
                    tokenContractURI,
                    royaltyReceiver,
                    royaltyFeeNumerator,
                } = request.body;

                const signer = await getSigner(chainId);
                const txService = new TransactionService(fastify);

                // Step 1: Deploy the contract
                const deployData = encodeDeployData({
                    abi: erc1155ItemsAbi,
                    bytecode: erc1155ItemsBytecode as `0x${string}`,
                    args: [],
                });

                request.log.info(`ERC1155Items sending deployment transaction`);
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
                    request.log.error(`ERC1155Items deployment transaction reverted: ${deployReceipt?.hash}`);
                    throw new Error('Contract deployment transaction reverted');
                }

                if (!deployedContractAddress) {
                    request.log.error('Contract address not found after deployment');
                    throw new Error('Contract address not found after deployment');
                }
                request.log.info(`ERC1155Items contract deployed at: ${deployedContractAddress}`);

                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress,
                    abi: erc1155ItemsAbi,
                    data: deployData,
                    txHash: deployReceipt?.hash ?? '',
                    isDeployTx: true,
                });

                // Step 2: Initialize the contract
                const initializeData = encodeFunctionData({
                    abi: erc1155ItemsAbi,
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

                const initializeTx = await signer.sendTransaction({
                    to: deployedContractAddress,
                    data: initializeData,
                });

                request.log.info(`ERC1155Items initialization transaction sent: ${initializeTx.hash} to contract: ${deployedContractAddress}`);
                const initializeReceipt = await initializeTx.wait();
                request.log.info(`ERC1155Items initialization transaction mined: ${initializeReceipt?.hash}`);

                if (initializeReceipt?.status === 0) {
                    request.log.error(`ERC1155Items initialization transaction reverted: ${initializeReceipt?.hash}`);
                    throw new Error('Contract initialization transaction reverted');
                }

                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress,
                    abi: erc1155ItemsAbi,
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
                request.log.error(error, 'Failed to deploy and initialize ERC1155Items contract');
                return reply.code(500).send({
                    result: {
                        deploymentTxHash: null,
                        deploymentTxUrl: null,
                        initializationTxHash: null,
                        initializationTxUrl: null,
                        contractAddress: null,
                        error: error instanceof Error ? error.message : 'Failed to deploy and initialize ERC1155Items contract',
                    },
                });
            }
        }
    );
}
