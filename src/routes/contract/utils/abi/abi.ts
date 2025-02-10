import type { FastifyInstance } from "fastify";
import { getAbiFromExplorer } from "../../../../utils";

type ReadContractResponse = {
    result?: {
        data: unknown;
        error?: string;
    };
}

type ReadRequestParams = {
    chainId: string;
    contractAddress: string;
}

export async function getAbi(fastify: FastifyInstance) {
    fastify.get<{
        Params: ReadRequestParams,
        Reply: ReadContractResponse;
    }>('/contract/:chainId/:contractAddress/abi', {
        schema: {
            querystring: {
                type: 'object',
                required: [],
                properties: {
                    args: { type: 'string' },
                    abi: { type: 'string' }
                }
            },
            params: {
                type: 'object',
                required: ['chainId', 'contractAddress'],
                properties: {
                    chainId: { type: 'string' },
                    contractAddress: { type: 'string' },
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress } = request.params;
            const abi = await getAbiFromExplorer(chainId, contractAddress);
            console.log(abi);
            return reply.code(200).send({
                result: {
                    data: abi
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