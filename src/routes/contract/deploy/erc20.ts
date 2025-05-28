import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeAbiParameters, encodeDeployData } from "viem";
import { erc20Abi } from "../../../constants/abis/erc20";
import { erc20bytecode } from "../../../constants/bytecodes/erc20";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl, getContractAddressFromEvent } from "../../../utils/other";
import { logRequest, logStep, logError } from '../../../utils/loggingUtils';
import { isContractVerified, verifyContract } from "../../../utils/contractVerification";
import { erc20JsonInputMetadata } from "../../../constants/contractJsonInputs/erc20";

type ERC20DeployRequestBody = {
    initialOwner: string;
    name: string;
    symbol: string;
}

type ERC20DeployRequestParams = {
    chainId: string;
}

type ERC20DeployResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        deployedContractAddress: string | null;
        error?: string;
    };
}

const ERC20DeploySchema = {
    tags: ['ERC20', 'Deploy'],
    description: 'Deploy an ERC20 contract by providing the initial owner, name and symbol',
    body: {
        type: 'object',
        required: ['initialOwner', 'name', 'symbol'],
        properties: {
            initialOwner: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
        }
    },
    params: {
        type: 'object',
        required: ['chainId'],
        properties: {
            chainId: { type: 'string' },
        }
    },
    headers: {
        type: 'object',
        required: ['x-secret-key'],
        properties: {
            'x-secret-key': { type: 'string' },
        }
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
                        deployedContractAddress: { type: 'string' },
                        error: { type: 'string', nullable: true }
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
    }
}

export async function erc20Deploy(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC20DeployRequestParams;
        Body: ERC20DeployRequestBody;
        Reply: ERC20DeployResponse;
    }>('/deploy/erc20/:chainId', {
        schema: ERC20DeploySchema
    }, async (request, reply) => {
        try {
            logRequest(request);

            const { chainId } = request.params;
            const { initialOwner, name, symbol } = request.body;

            logStep(request, 'Getting tx signer', { chainId });
            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            logStep(request, 'Preparing deploy data', {
                abi: erc20Abi,
                bytecode: erc20bytecode,
                args: [initialOwner, name, symbol]
            });
            const data = encodeDeployData({
                abi: erc20Abi,
                bytecode: erc20bytecode as `0x${string}`,
                args: [initialOwner, name, symbol]
            });
            logStep(request, 'Deploy data prepared', { data });

            logStep(request, 'Sending deploy transaction', { data });
            const tx = await signer.sendTransaction({
                data
            });
            logStep(request, 'Deploy transaction sent', { tx });

            logStep(request, 'Waiting for deploy receipt', { txHash: tx.hash });
            const receipt = await tx.wait();
            logStep(request, 'Deploy receipt received', { receipt });

            const deployedContractAddress = getContractAddressFromEvent(receipt, 'CreatedContract(address)');

            if(receipt?.status === 0) {
                logError(request, new Error('Transaction reverted'), { receipt });
                throw new Error('Transaction reverted');
            }

            logStep(request, 'Creating transaction record in db', {
                chainId,
                contractAddress: deployedContractAddress,
                abi: erc20Abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true    
            });
            const txService = new TransactionService(fastify);
            await txService.createTransaction({
                chainId,
                contractAddress: deployedContractAddress,
                abi: erc20Abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true    
            });

            logStep(request, 'Deploy transaction success', { txHash: receipt?.hash });

            if (process.env.VERIFY_CONTRACT_ON_DEPLOY === 'true' && !isContractVerified(deployedContractAddress, chainId)) {
                logStep(request, 'Verifying contract', {
                    chainId,
                    contractAddress: deployedContractAddress,
                    contractName: 'ERC20',
                });

                const encodedConstructorArguments = encodeAbiParameters(
                    [
                        { name: 'initialOwner', type: 'address' },
                        { name: 'name', type: 'string' },
                        { name: 'symbol', type: 'string' }
                    ],
                    [initialOwner as `0x${string}`, name, symbol]
                );

                // Remove "0x" prefix if present
                const encodedArgsNoPrefix = encodedConstructorArguments.startsWith('0x')
                    ? encodedConstructorArguments.slice(2)
                    : encodedConstructorArguments;

                const response = await verifyContract({
                    chainId,
                    contractAddress: deployedContractAddress,
                    contractName: "contracts/ERC20.sol:Token",
                    compilerVersion: 'v0.8.27+commit.40a35a09',
                    contractInputMetadata: erc20JsonInputMetadata,
                    constructorArguments: encodedArgsNoPrefix
                });

                logStep(request, 'Contract verification response: ', { response });
            }
            
            return reply.code(200).send({
                result: {
                    txHash: receipt?.hash ?? null,
                    txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
                    deployedContractAddress: deployedContractAddress
                }
            });

        } catch (error) {
            logError(request, error, {
                params: request.params,
                body: request.body
            });
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    deployedContractAddress: null,
                    error: error instanceof Error ? error.message : 'Failed to deploy ERC20'
                }
            });
        }
    });
}
