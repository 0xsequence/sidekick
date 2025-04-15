import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData } from "viem";
import { TransactionService } from "../../../services/transaction.service";
import type { ethers } from "ethers";

type DeployContractRequestBody = {
    abi: Array<ethers.InterfaceAbi>;
    bytecode: string;
    args: Array<string>;
}

type DeployContractRequestParams = {
    chainId: string;
}

type DeployContractResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const DeployContractSchema = {
    tags: ['Contract', 'Deploy'],
    description: 'Deploy any contract by providing the abi, bytecode and constructor arguments',
    body: {
        type: 'object',
        required: ['args', 'abi', 'bytecode'],
        properties: {
            args: { type: 'array', items: { type: 'string' } },
            abi: { type: 'array', items: { type: 'object' } },
            bytecode: { type: 'string', description: 'String representation of the bytecode without the 0x prefix' }
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
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function deployContract(fastify: FastifyInstance) {
    fastify.post<{
        Params: DeployContractRequestParams;
        Body: DeployContractRequestBody;
        Reply: DeployContractResponse;
    }>('/deploy/contract/:chainId', {
        schema: DeployContractSchema
    }, async (request, reply) => {
        try {
            const { chainId } = request.params;
            const { args, abi, bytecode } = request.body;

            if(!bytecode.startsWith('0x')) {
                return reply.code(400).send({
                    result: {
                        txHash: null,
                        txUrl: null,
                        error: 'Bytecode must start with 0x'
                    }
                });
            }

            const signer = await getSigner(chainId);
            const txService = new TransactionService(fastify);

            const data = encodeDeployData({
                abi,
                bytecode: bytecode as `0x${string}`,
                args
            })

            const tx = await signer.sendTransaction({
                data
            })

            const receipt = await tx.wait();

            if (receipt?.status === 0) {
                throw new Error('Transaction reverted');
            }

            await txService.createTransaction({
                chainId,
                contractAddress: receipt?.contractAddress ?? '',
                abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true
            })

            return reply.code(200).send({
                result: {
                    txHash: receipt?.hash ?? null,
                    txUrl: `https://${chainId}.etherscan.io/tx/${receipt?.hash}`
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    error: error instanceof Error ? error.message : 'Failed to mint NFT'
                }
            });
        }
    });
}
