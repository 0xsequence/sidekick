import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils";
import { ethers, Interface } from "ethers";
import { erc20Abi } from "viem";

// Types for request/response
type ReadRequestBody = {
    abi: Interface;
    args?: string; // JSON stringified array
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

export async function readContract(fastify: FastifyInstance) {
    fastify.post<{
        Params: ReadRequestParams,
        Body: ReadRequestBody;
        Reply: ReadContractResponse;
    }>('/contract/:chainId/:contractAddress/read/:functionName', {
        schema: {
            body: {
                type: 'object',
                required: ['abi', 'args'],
                properties: {
                    abi: { type: 'string' },
                    args: {
                        type: 'string',
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
            }
        }
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress, functionName } = request.params;
            const { args, abi } = request.body;

            const parsedArgs = JSON.parse(args ?? "[]");

            const provider = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                abi,
                provider
            );

            let data = null;
            if (parsedArgs.length > 0) {
                data = await contract[functionName](...parsedArgs);
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