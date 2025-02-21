import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import { ethers } from "ethers";
import { erc1155Abi } from "../../../../../constants/abis/erc1155";

type ERC1155MinterRoleRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC1155MinterRoleResponse = {
    result?: {
        data: unknown;
        error?: string;
    };
}

const ERC1155MinterRoleSchema = {
    tags: ['ERC1155'],
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' },
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

export async function erc1155MinterRole(fastify: FastifyInstance) {
    fastify.get<{
        Params: ERC1155MinterRoleRequestParams;
        Reply: ERC1155MinterRoleResponse;
    }>('/read/erc1155/:chainId/:contractAddress/minterRole', {
        schema: ERC1155MinterRoleSchema
    }, async (request, reply) => {
        try {
            const { chainId, contractAddress } = request.params;

            const provider = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc1155Abi,
                provider
            );

            const data = await contract.MINTER_ROLE();

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
