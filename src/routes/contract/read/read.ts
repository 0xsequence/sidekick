import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils";
import { ethers, Interface } from "ethers";
import { erc20Abi } from "viem";

// Types for request/response
type ReadRequestBody = {
    abi: Array<Object>;    // This should be a string that we'll parse into Interface
    args?: Array<any>;  // JSON stringified array
}

type ReadContractResponse = {
    result?: {
        data: unknown;
        error?: string;
    };
}

type ReadRequestParams = {
    chainId: string;
    contractAddress: string;
    functionName: string;
}

const ReadContractSchema = {
    description: 'Read from a smart contract',
    tags: ['Contract'],
    body: {
        type: 'object',
        required: ['abi'],
        properties: {
            abi: {
                type: 'array',
                description: 'Contract ABI array'
            },
            args: {
                type: 'array',
                description: 'Array of function arguments'
            }
        }
    },
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress', 'functionName'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' },
            functionName: { type: 'string' }
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
                        data: { type: 'string' },
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function readContract(fastify: FastifyInstance) {
    fastify.post<{
        Params: ReadRequestParams,
        Body: ReadRequestBody;
        Reply: ReadContractResponse;
    }>('/contract/:chainId/:contractAddress/read/:functionName', {
        schema: ReadContractSchema
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress, functionName } = request.params;
            const { args, abi } = request.body;

            const provider = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                abi,
                provider
            );

            let data = null;
            if (args) {
                data = await contract[functionName](...args);
            } else {
                data = await contract[functionName]();
            }

            return reply.code(200).send({
                result: {
                    data: data.toString()
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: null,
                    error: error instanceof Error ? error.message : 'Failed to read from contract'
                }
            });
        }
    });
}