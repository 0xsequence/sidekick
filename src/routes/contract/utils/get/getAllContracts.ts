import type { Contract } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { ContractSchema } from "../../../../schemas/contractSchemas";
import { Type } from "@sinclair/typebox";

type GetAllContractsResponse = {
    result?: {
        data: {
            contracts: Array<Contract>;
        };
        error?: string;
    };
}

const getAllContractsSchema = {
    tags: ['Contract'],
    response: {
        200: Type.Object({
            result: Type.Object({
                data: Type.Object({
                    contracts: Type.Array(ContractSchema)
                }),
                error: Type.Optional(Type.String())
            })
        })
    }
}

export async function getAllContracts(fastify: FastifyInstance) {
    fastify.get<{
        Reply: GetAllContractsResponse;
    }>('/contract/getAll', {
        schema: getAllContractsSchema
    }, async (request, reply) => {
        try {
            const contracts = await fastify.prisma.contract.findMany();

            return reply.code(200).send({
                result: {
                    data: {
                        contracts
                    }
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: {
                        contracts: []
                    },
                    error: error instanceof Error ? error.message : 'Failed to get all contracts'
                }
            });
        }
    });
}