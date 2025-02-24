import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import { ethers } from "ethers";
import { erc721Abi } from "viem";
import { erc1155Abi } from "../../../../../constants/abis/erc1155";

type ERC1155BalanceOfRequestQuery = {
    account: string;
    id: string;
}

type ERC1155BalanceOfRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC1155BalanceOfResponse = {
    result?: {
        data: unknown;
        error?: string;
    };
}

const ERC1155BalanceOfSchema = {
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
        required: ['account', 'id'],
        properties: {
            account: { type: 'string' },
            id: { type: 'string' }
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

export async function erc1155BalanceOf(fastify: FastifyInstance) {
    fastify.get<{
        Params: ERC1155BalanceOfRequestParams;
        Querystring: ERC1155BalanceOfRequestQuery;
        Reply: ERC1155BalanceOfResponse;
    }>('/read/erc1155/:chainId/:contractAddress/balanceOf', {
        schema: ERC1155BalanceOfSchema
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress } = request.params;
            const { account, id } = request.query;

            const provider = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc1155Abi,
                provider
            );

            const data = await contract['balanceOf'](account, id);

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
