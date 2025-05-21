import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData, encodeFunctionData, type Abi } from "viem";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl, getContractAddressFromEvent } from "../../../utils/other";
import { erc721ItemsBytecode } from "../../../constants/bytecodes/erc721Items";
import { erc721ItemsAbi } from "../../../constants/abis/erc721Items";
import { ethers, type TransactionReceipt, type TransactionResponse } from "ethers";
import { logRequest, logStep, logError } from '../../../utils/loggingUtils';


type ERC721ItemsDeployAndInitializeRequestBody = {
    owner: string;
    tokenName: string;
    tokenSymbol: string;
    tokenBaseURI: string;
    tokenContractURI: string;
    royaltyReceiver: string;
    royaltyFeeNumerator: string; 
};

type ERC721ItemsDeployAndInitializeRequestParams = {
    chainId: string;
};

type ERC721ItemsDeployAndInitializeResponse = {
    result?: {
        deploymentTxHash?: string | null;
        deploymentTxUrl?: string | null;
        initializationTxHash: string | null;
        initializationTxUrl: string | null;
        deployedContractAddress: string | null;
        error?: string;
    };
};

const ERC721ItemsDeployAndInitializeSchema = {
    tags: ['ERC721Items', 'Deploy', 'Initialize', 'Upgradeable'],
    description: 'Deploy and initialize an ERC721Items contract.',
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
                        deployedContractAddress: { type: 'string' },
                        error: { type: 'string', nullable: true },
                    },
                },
            },
        },
    },
};

export async function erc721ItemsDeployAndInitialize(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721ItemsDeployAndInitializeRequestParams;
        Body: ERC721ItemsDeployAndInitializeRequestBody;
        Reply: ERC721ItemsDeployAndInitializeResponse;
    }>(
        '/deployAndInitialize/erc721Items/:chainId',
        {
            schema: ERC721ItemsDeployAndInitializeSchema,
        },
        async (request, reply) => {
            try {
                logRequest(request);
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

                logStep(request, 'Getting tx signer', { chainId });
                const signer = await getSigner(chainId);
                logStep(request, 'Tx signer received', { signer: signer.account.address });
                const txService = new TransactionService(fastify);

                // Step 1: Deploy the contract
                logStep(request, 'Preparing deploy data', {
                    abi: erc721ItemsAbi,
                    bytecode: erc721ItemsBytecode,
                    args: []
                });
                const deployData = encodeDeployData({
                    abi: erc721ItemsAbi,
                    bytecode: erc721ItemsBytecode as `0x${string}`,
                    args: [],
                });
                logStep(request, 'Deploy data prepared', { deployData });

                logStep(request, 'Sending deployment transaction', { deployData });
                const deployTx: TransactionResponse = await signer.sendTransaction({
                    data: deployData
                });
                logStep(request, 'Deployment transaction sent', { deployTx });

                logStep(request, 'Waiting for deployment receipt', { txHash: deployTx.hash });
                const deployReceipt: TransactionReceipt | null = await deployTx.wait();
                logStep(request, 'Deployment receipt received');

                const deployedContractAddress = getContractAddressFromEvent(deployReceipt, 'CreatedContract(address)');
                logStep(request, 'Deployed contract address extracted', { deployedContractAddress });
                
                if (deployReceipt?.status === 0) {
                    logError(request, new Error('Contract deployment transaction reverted'), { deployReceipt });
                    throw new Error('Contract deployment transaction reverted');
                }

                if (!deployedContractAddress) {
                    logError(request, new Error('Contract address not found after deployment'), { deployReceipt });
                    throw new Error('Contract address not found after deployment');
                }
                logStep(request, 'Contract deployed', { deployedContractAddress });

                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress,
                    abi: erc721ItemsAbi,
                    data: deployData,
                    txHash: deployReceipt?.hash ?? '',
                    isDeployTx: true,
                });

                // Step 2: Initialize the contract
                logStep(request, 'Preparing initialize data', {
                    functionName: 'initialize',
                    args: [owner, tokenName, tokenSymbol, tokenBaseURI, tokenContractURI, royaltyReceiver, royaltyFeeNumerator]
                });
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
                logStep(request, 'Initialize data prepared', { initializeData });

                logStep(request, 'Sending initialization transaction', { to: deployedContractAddress, initializeData });
                const initializeTx = await signer.sendTransaction({
                    to: deployedContractAddress,
                    data: initializeData,
                });
                logStep(request, 'Initialization transaction sent');

                logStep(request, 'Waiting for initialization receipt', { txHash: initializeTx.hash });
                const initializeReceipt = await initializeTx.wait();
                logStep(request, 'Initialization receipt received', { initializeReceipt });

                if (initializeReceipt?.status === 0) {
                    logError(request, new Error('Contract initialization transaction reverted'), { initializeReceipt });
                    throw new Error('Contract initialization transaction reverted');
                }

                logStep(request, 'Creating transaction record in db');
                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress,
                    abi: erc721ItemsAbi,
                    data: initializeData,
                    isDeployTx: false, 
                });

                logStep(request, 'Deploy and initialize success', {
                    deploymentTxHash: deployReceipt?.hash ?? null,
                    initializationTxHash: initializeReceipt?.hash ?? null,
                    contractAddress: deployedContractAddress
                });

                return reply.code(200).send({
                    result: {
                        deploymentTxHash: deployReceipt?.hash ?? null,
                        deploymentTxUrl: getBlockExplorerUrl(Number(chainId), deployReceipt?.hash ?? ''),
                        initializationTxHash: initializeReceipt?.hash ?? null,
                        initializationTxUrl: getBlockExplorerUrl(Number(chainId), initializeReceipt?.hash ?? ''),
                        deployedContractAddress: deployedContractAddress,
                    },
                });
            } catch (error) {
                logError(request, error, {
                    params: request.params,
                    body: request.body
                });
                return reply.code(500).send({
                    result: {
                        deploymentTxHash: null,
                        deploymentTxUrl: null,
                        initializationTxHash: null,
                        initializationTxUrl: null,
                        deployedContractAddress: null,
                        error: error instanceof Error ? error.message : 'Failed to deploy and initialize ERC721Items contract',
                    },
                });
            }
        }
    );
}
