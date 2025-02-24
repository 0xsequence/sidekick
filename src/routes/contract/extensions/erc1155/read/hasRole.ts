import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import { ethers } from "ethers";
import { erc721Abi } from "viem";
import { erc1155Abi } from "../../../../../constants/abis/erc1155";

type ERC1155HasRoleRequestQuery = {
    role: string;
    account: string;
}

type ERC1155HasRoleRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC1155HasRoleResponse = {
    result?: {
        data: unknown;
        error?: string;
    };
}

const ERC1155HasRoleSchema = {
    tags: ['ERC1155'],
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' },
        }
    },
    query: {
        type: 'object',
        required: ['role', 'account'],
        properties: {
            role: { type: 'string' },
            account: { type: 'string' }
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

export async function erc1155HasRole(fastify: FastifyInstance) {
    fastify.get<{
        Params: ERC1155HasRoleRequestParams;
        Querystring: ERC1155HasRoleRequestQuery;
        Reply: ERC1155HasRoleResponse;
    }>('/read/erc1155/:chainId/:contractAddress/hasRole', {
        schema: ERC1155HasRoleSchema
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress } = request.params;
            const { role, account } = request.query;

            const provider = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc1155Abi,
                provider
            );

            const data = await contract['hasRole'](role, account);
            console.log("Has role ", role, " for account ", account, " is ", data);

            return reply.code(200).send({
                result: {
                    data: data.toString(),
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: null,
                    error: error instanceof Error ? error.message : 'Failed to read balance'
                }
            });
        }
    });
}
