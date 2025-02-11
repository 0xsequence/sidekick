import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import type { Interface } from "ethers";
import { getBlockExplorerUrl } from '../../../utils'
import { prisma } from '../../../lib/prisma'

// Types for request/response
type WriteRequestBody = {
    abi: Interface;  // Make abi required again
    args?: string;
}

type WriteRequestParams = {
    chainId: string;
    contractAddress: string;
    functionName: string;
}

export type WriteContractResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const WriteContractSchema = {
    description: 'Write to a smart contract',
    tags: ['Contract'],
    body: {
        type: 'object',
        required: ['abi', 'args'],
        properties: {
            args: {
                type: 'string',
                description: 'JSON stringified array of function arguments'
            },
            abi: {
                type: 'string',
                description: 'Contract ABI in JSON format'
            },
        }
    },
    headers: {
        type: 'object',
        required: ['x-secret-key', 'x-wallet-address'],
        properties: {
            'x-secret-key': { type: 'string' },
            'x-wallet-address': { type: 'string' }
        }
    },
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress', 'functionName'],
        properties: {
            chainId: {
                type: 'string',
                description: 'Chain ID of the network'
            },
            contractAddress: {
                type: 'string',
                description: 'Contract address'
            },
            functionName: {
                type: 'string',
                description: 'Function name to call'
            }
        }
    },
    response: {
        200: {
            description: 'Successful response',
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        txHash: { type: 'string', nullable: true },
                        txUrl: { type: 'string', nullable: true },
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function writeContract(fastify: FastifyInstance) {
    fastify.post<{ 
        Params: WriteRequestParams;
        Body: WriteRequestBody;
        Reply: WriteContractResponse;
    }>('/contract/:chainId/:contractAddress/write/:functionName', {
        schema: WriteContractSchema
    }, async (request, reply) => {
        try {
            const { args, abi } = request.body;
            const { chainId, contractAddress, functionName } = request.params;

            const parsedArgs = JSON.parse(args ?? "[]");

            // Get wallet from request headers
            const walletAddress = request.headers['x-wallet-address'];
            if (!walletAddress || typeof walletAddress !== 'string') {
                return reply.code(400).send({
                    result: {
                        txHash: null,
                        txUrl: null,
                        error: 'Missing or invalid wallet address header'
                    }
                });
            }

            // Get the signer to use for the transaction
            const signer = await getSigner(chainId);

            // Create contract instance with full ABI
            const contract = new ethers.Contract(
                contractAddress,
                abi,
                signer
            );

            // Encode function data dynamically
            const data = contract.interface.encodeFunctionData(
                functionName,
                parsedArgs ?? null
            );

            const tx = {
                to: contractAddress,
                data
            }

            const txResponse: TransactionResponse = await signer.sendTransaction(tx);

            // Save transaction to database
            // TODO: Handle status 
            await prisma.transaction.create({
                data: {
                    hash: txResponse.hash,
                    chainId: Number(chainId),
                    from: walletAddress,
                    to: contractAddress,
                    data: data,
                    status: 'done'
                }
            });

            return reply.code(200).send({
                result: {
                    txHash: txResponse.hash,
                    txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash)
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    error: error instanceof Error ? error.message : 'Failed to execute contract transaction'
                }
            });
        }
    });
}