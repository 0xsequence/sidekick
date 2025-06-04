import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData, encodeFunctionData } from "viem";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl, getContractAddressFromEvent } from "../../../utils/other";
import { erc1155ItemsBytecode } from "../../../constants/bytecodes/erc1155Items";
import { erc1155ItemsAbi } from "../../../constants/abis/erc1155Items";
import { type TransactionReceipt, type TransactionResponse } from "ethers";
import { logRequest, logStep, logError } from '../../../utils/loggingUtils';
import { getTenderlySimulationUrl } from "../utils/tenderly/getSimulationUrl";
import { prepareTransactionsForTenderlySimulation } from "../utils/tenderly/getSimulationUrl";

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
        deployedContractAddress: string | null;
        txSimulationUrls?: string[];
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
                        deployedContractAddress: { type: 'string' },
                        txSimulationUrls: { type: 'array', items: { type: 'string' } },
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
            let deploymentSimulationUrl: string | null = null;
            let initializationSimulationUrl: string | null = null;
            try {
                logRequest(request);
                const { chainId } = request.params;
                const {
                    owner,
                    tokenName,
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
                    abi: erc1155ItemsAbi,
                    bytecode: erc1155ItemsBytecode,
                    args: []
                });
                const deployData = encodeDeployData({
                    abi: erc1155ItemsAbi,
                    bytecode: erc1155ItemsBytecode as `0x${string}`,
                    args: [],
                });
                logStep(request, 'Deploy data prepared');

                logStep(request, 'Sending deployment transaction');
                const deployTx: TransactionResponse = await signer.sendTransaction({
                    data: deployData
                });
                logStep(request, 'Deployment transaction sent', { deployTx });

                const {simulationData: deploymentSimulationData, signedTx: deploymentSignedTx} = await prepareTransactionsForTenderlySimulation(signer, [deployTx], Number(chainId));
                let deploymentSimulationUrl = getTenderlySimulationUrl({
                    chainId: chainId,
                    gas: 3000000,
                    block: await signer.provider.getBlockNumber(),
                    contractAddress: deploymentSignedTx.entrypoint,
                    blockIndex: 0,
                    rawFunctionInput: deploymentSimulationData
                });

                logStep(request, 'Waiting for deployment receipt', { txHash: deployTx.hash });
                const deployReceipt: TransactionReceipt | null = await deployTx.wait();
                logStep(request, 'Deployment receipt received', { deployReceipt });

                const deployedContractAddress = getContractAddressFromEvent(deployReceipt, 'CreatedContract(address)');

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
                    abi: erc1155ItemsAbi,
                    data: deployData,
                    txHash: deployReceipt?.hash ?? '',
                    isDeployTx: true,
                });

                // Step 2: Initialize the contract
                logStep(request, 'Preparing initialize data', {
                    functionName: 'initialize',
                    args: [owner, tokenName, tokenBaseURI, tokenContractURI, royaltyReceiver, royaltyFeeNumerator]
                });
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
                logStep(request, 'Initialize data prepared', { initializeData });

                const initializationTx = {
                    to: deployedContractAddress,
                    data: initializeData
                }

                const {simulationData: initializationSimulationData, signedTx: initializationSignedTx} = await prepareTransactionsForTenderlySimulation(signer, [initializationTx], Number(chainId));
                let initializationSimulationUrl = getTenderlySimulationUrl({
                    chainId: chainId,
                    gas: 3000000,
                    block: await signer.provider.getBlockNumber(),
                    contractAddress: initializationSignedTx.entrypoint,
                    blockIndex: 0,
                    rawFunctionInput: initializationSimulationData
                });

                logStep(request, 'Sending initialization transaction');
                const initializeTx = await signer.sendTransaction(initializationTx);
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
                    abi: erc1155ItemsAbi,
                    data: initializeData,
                    txHash: initializeReceipt?.hash ?? '',
                    isDeployTx: false,
                });

                logStep(request, 'Deploy and initialize success');

                return reply.code(200).send({
                    result: {
                        deploymentTxHash: deployReceipt?.hash ?? null,
                        deploymentTxUrl: getBlockExplorerUrl(Number(chainId), deployReceipt?.hash ?? ''),
                        initializationTxHash: initializeReceipt?.hash ?? null,
                        initializationTxUrl: getBlockExplorerUrl(Number(chainId), initializeReceipt?.hash ?? ''),
                        deployedContractAddress: deployedContractAddress,
                        txSimulationUrls: [deploymentSimulationUrl, initializationSimulationUrl],
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
                        txSimulationUrls: [deploymentSimulationUrl ?? '', initializationSimulationUrl ?? ''],
                        error: error instanceof Error ? error.message : 'Failed to deploy and initialize ERC1155Items contract',
                    },
                });
            }
        }
    );
}
