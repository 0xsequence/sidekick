import type { FastifyInstance } from "fastify";
import { AbiSchema } from "../../../../schemas/contractSchemas";

type AddContractResponse = {
    result?: {
        data: unknown;
        error?: string;
    };
}

type AddContractRequestBody = {
    contractName: string;
    contractAddress: string;
    chainId: number;
    abi: Array<Object>;
    bytecode: string;
    bytecode_hash?: string;
    symbol?: string;
}

const addContractSchema = {
    headers: {
        type: 'object',
        required: ['x-secret-key'],
        properties: {
            'x-secret-key': { type: 'string' },
        }
    },
    body: {
        type: 'object',
        required: ['contractName', 'contractAddress', 'chainId', 'abi', 'bytecode'],
        properties: {
            contractName: { type: 'string' },
            contractAddress: { type: 'string' },
            chainId: { type: 'number' },
            abi: { 
                type: 'array',
                items: AbiSchema
            },
            bytecode: { type: 'string' },
            bytecode_hash: { type: 'string', nullable: true },
            symbol: { type: 'string', nullable: true }
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'object'
                        }
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
                        data: {
                            type: 'object'
                        },
                        error: {
                            type: 'string'
                        }
                    }
                }
            }
        }
    }
}

export async function addContract(fastify: FastifyInstance) {
    fastify.post<{
        Reply: AddContractResponse;
        Body: AddContractRequestBody;
    }>('/contract/add', {
        schema: addContractSchema
    }, async (request, reply) => {
        try {
            const { contractName, contractAddress, chainId, abi, bytecode, bytecode_hash, symbol } = request.body;

            const contract = await fastify.prisma.contract.create({
                data: {
                    contractName,
                    contractAddress,
                    chainId,
                    abi: JSON.stringify(abi),
                    bytecode,
                    bytecode_hash,
                    symbol
                }
            })

            return reply.code(200).send({
                result: {
                    data: contract
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: null,
                    error: error instanceof Error ? error.message : 'Failed to add contract'
                }
            });
        }
    });
}