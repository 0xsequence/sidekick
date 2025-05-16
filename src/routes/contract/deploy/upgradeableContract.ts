import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData, encodeFunctionData } from "viem";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../utils/other";
import { ethers } from "ethers"; 

type DeployUpgradeableContractRequestBody = {
    implementationAbi: Array<ethers.InterfaceAbi>;
    implementationBytecode: string;
    initializeFunctionName: string;
    initializeArgs: Array<string>;
};

type DeployUpgradeableContractRequestParams = {
    chainId: string;
};

type DeployUpgradeableContractResponse = {
    result?: {
        deploymentTxHash?: string | null;
        deploymentTxUrl?: string | null;
        initializationTxHash: string | null;
        initializationTxUrl: string | null;
        contractAddress: string | null;
        error?: string;
    };
};

const DeployUpgradeableContractSchema = {
    tags: ['Contract', 'Deploy', 'Upgradeable'],
    description: 'Deploy an upgradeable contract\'s implementation and call its initialize function.',
    params: {
        type: 'object',
        required: ['chainId'],
        properties: {
            chainId: { type: 'string' },
        },
    },
    body: {
        type: 'object',
        required: [
            'implementationAbi',
            'implementationBytecode',
            'initializeFunctionName',
            'initializeArgs',
        ],
        properties: {
            implementationAbi: { type: 'array', items: { type: 'object' } },
            implementationBytecode: { type: 'string' },
            initializeFunctionName: { type: 'string' },
            initializeArgs: { type: 'array', items: { type: 'string' } }
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
        400: {
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            }
        },
        500: {
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            }
        }
    },
};

export async function deployUpgradeableContract(fastify: FastifyInstance) {
    fastify.post<{
        Params: DeployUpgradeableContractRequestParams;
        Body: DeployUpgradeableContractRequestBody;
        Reply: DeployUpgradeableContractResponse;
    }>(
        '/deploy/upgradeableContract/:chainId',
        {
            schema: DeployUpgradeableContractSchema,
        },
        async (request, reply) => {
            try {
                const { chainId } = request.params;
                const {
                    implementationAbi,
                    implementationBytecode,
                    initializeFunctionName,
                    initializeArgs,
                } = request.body;

                if (!implementationBytecode.startsWith('0x')) {
                    return reply.code(400).send({
                        result: {
                            deploymentTxHash: null,
                            deploymentTxUrl: null,
                            initializationTxHash: null,
                            initializationTxUrl: null,
                            contractAddress: null,
                            error: 'Implementation bytecode must start with 0x',
                        },
                    });
                }

                const signer = await getSigner(chainId);
                if (!signer || !signer.account?.address) {
                    request.log.error('Signer account or address is null or undefined. Check getSigner implementation and EVM_PRIVATE_KEY.');
                    throw new Error('Signer not configured correctly.');
                }
                request.log.info(`Using signer address: ${signer.account.address} for deploying upgradeable contract on chain ${chainId}`);

                const txService = new TransactionService(fastify);

                // Step 1: Deploy the implementation contract
                const deployData = encodeDeployData({
                    abi: implementationAbi,
                    bytecode: implementationBytecode as `0x${string}`,
                    args: [], // Standard for UUPS/Transparent proxy implementations
                });

                request.log.info(`Sending implementation deployment transaction for chainId: ${chainId}`);
                const deployTxResponse = await signer.sendTransaction({
                    data: deployData,
                });
                request.log.info(`Implementation deployment transaction sent: ${deployTxResponse.hash}`);
                
                const deployReceipt = await deployTxResponse.wait();
                request.log.info(`Implementation deployment transaction mined: ${deployReceipt?.hash}, status: ${deployReceipt?.status}`);

                if (deployReceipt?.status === 0) {
                    request.log.error(`Implementation deployment transaction reverted: ${deployReceipt?.hash}`);
                    throw new Error('Implementation contract deployment transaction reverted');
                }

                const contractCreatedEvent = deployReceipt?.logs.find(log =>
                    log.topics.includes(ethers.id('CreatedContract(address)'))
                )

                const deployedContractAddress = ethers.getAddress(
                    ethers.zeroPadValue(ethers.stripZerosLeft(contractCreatedEvent?.data ?? ''), 20)
                )

                if (!deployedContractAddress) {
                    request.log.error('Contract address not found after implementation deployment.');
                    throw new Error('Contract address not found after implementation deployment. This can happen if the transaction failed or is not a contract creation.');
                }
                request.log.info(`Implementation contract deployed at: ${deployedContractAddress} on chainId: ${chainId}`);

                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress,
                    abi: implementationAbi,
                    data: deployData,
                    txHash: deployReceipt?.hash ?? '',
                    isDeployTx: true,
                });

                // Step 2: Initialize the contract
                request.log.info(`Encoding initialize function '${initializeFunctionName}' for contract ${deployedContractAddress}`);
                const initializeData = encodeFunctionData({
                    abi: implementationAbi,
                    functionName: initializeFunctionName,
                    args: initializeArgs,
                });

                request.log.info(`Sending initialization transaction to ${deployedContractAddress} for function '${initializeFunctionName}'`);
                const initializeTxResponse = await signer.sendTransaction({
                    to: deployedContractAddress,
                    data: initializeData,
                });
                request.log.info(`Initialization transaction sent: ${initializeTxResponse.hash}`);

                const initializeReceipt = await initializeTxResponse.wait();
                request.log.info(`Initialization transaction mined: ${initializeReceipt?.hash}, status: ${initializeReceipt?.status}`);

                if (initializeReceipt?.status === 0) {
                    request.log.error(`Initialization transaction reverted: ${initializeReceipt?.hash}`);
                    throw new Error(`Contract initialization transaction for function '${initializeFunctionName}' reverted`);
                }

                await txService.createTransaction({
                    chainId,
                    contractAddress: deployedContractAddress, 
                    abi: implementationAbi,
                    data: initializeData,
                    txHash: initializeReceipt?.hash ?? '',
                    functionName: initializeFunctionName,
                    args: initializeArgs,
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
                request.log.error(error, 'Failed to deploy and initialize upgradeable contract');
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during upgradeable contract deployment';
                // Ensure the error object structure matches the schema for 500 responses
                return reply.code(500).send({
                    result: {
                        deploymentTxHash: null,
                        deploymentTxUrl: null,
                        initializationTxHash: null,
                        initializationTxUrl: null,
                        contractAddress: null,
                        error: errorMessage,
                    },
                });
            }
        }
    );
}
