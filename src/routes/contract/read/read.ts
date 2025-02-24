import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { ethers } from "ethers";

// Types for request/response
type ReadRequestBody = {
    abi?: Array<Object>;   
    args?: Array<any>;  
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
        properties: {
            abi: {
                type: 'array',
                description: 'Contract ABI in JSON format. If not provided, the ABI will be fetched from the sidekick database, make sure the contract is added to the database first or pass the abi manually.',
            },
            args: {
                type: 'array',
                description: 'Array of function arguments',
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
    }>('/read/contract/:chainId/:contractAddress/:functionName', {
        schema: ReadContractSchema
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress, functionName } = request.params;
            const { args, abi: abiFromBody } = request.body;

            const provider = await getSigner(chainId);

            let abiFromDb: Array<Object> | undefined;
            if (!abiFromBody) {
                const contract = await fastify.prisma.contract.findUnique({
                    where: {
                        contractAddress,
                        chainId: Number(chainId)
                    },
                })

                if (contract) {
                    if (!contract.abi) {
                        return reply.code(400).send({
                            result: {
                                data: null,
                                error: 'Contract ABI not found in db. Make sure the contract is added to the database first or pass the abi manually.'
                            }
                        })
                    }
                    abiFromDb = JSON.parse(contract.abi)
                } else {
                    return reply.code(400).send({
                        result: {
                            data: null,
                            error: 'Contract not found in db.'
                        }
                    })
                }
            }

            const contract = new ethers.Contract(
                contractAddress,
                abiFromBody ?? abiFromDb!,
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