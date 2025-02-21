import type { FastifyInstance } from "fastify";
import type { Contract } from "../../../../types/contract";
import { ethers } from "ethers";
import { getSigner } from "../../../../utils/wallet";

type IsDeployedResponse = {
    result?: {
        data: boolean;
        error?: string;
    };
}

type IsDeployedRequestParams = {
    chainId: string;
    contractAddress: string;
}

const isDeployedSchema = {
    tags: ['Contract'],
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' }
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
                            type: 'boolean'
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
                            type: 'boolean'
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

export async function isDeployed(fastify: FastifyInstance) {
    fastify.get<{
        Params: IsDeployedRequestParams;
        Reply: IsDeployedResponse;
    }>('/contract/isDeployed/:chainId/:contractAddress', {
        schema: isDeployedSchema
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress } = request.params;
            
            const signer = await getSigner(chainId);
            const bytecode = await signer.provider?.getCode(contractAddress);

            return reply.code(200).send({
                result: {
                    data: bytecode !== "0x"
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: false,
                    error: error instanceof Error ? error.message : 'Failed to import contracts'
                }
            });
        }
    });
}