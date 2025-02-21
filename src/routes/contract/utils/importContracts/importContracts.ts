import type { FastifyInstance } from "fastify";
import type { Contract } from "../../../../types/contract";

type ImportContractsResponse = {
    result?: {
        data: unknown;
        error?: string;
    };
}

type ImportContractsRequestParams = {
    projectId: string;
}

const importContractsSchema = {
    params: {
        type: 'object',
        required: ['projectId'],
        properties: {
            projectId: { type: 'string' }
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

export async function importContracts(fastify: FastifyInstance) {
    fastify.post<{
        Params: ImportContractsRequestParams;
        Reply: ImportContractsResponse;
    }>('/contract/importAllFromBuilder/:projectId', {
        schema: importContractsSchema
    }, async (request, reply) => {
        try {
            const { projectId } = request.params;
            console.log('Project ID: ', projectId);
            const response = await fetch('https://api.sequence.build/rpc/Builder/ListContracts', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${process.env.BUILDER_TOKEN}`,
                    'Accept': '*/*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: Number(projectId),
                })
            });

            const data: any = await response.json();
            const contracts: Contract[] = data.contracts;
            console.log('Contracts: ', contracts);

            // Now add these contracts to the database, check by id if they exist, if they do then update them, if they don't then create them
            await Promise.all(
                contracts.map(contract =>
                    fastify.prisma.contract.upsert({
                        where: { id: contract.id },
                        update: { ...contract, addedBy: 'builder' },
                        create: { ...contract, addedBy: 'builder' }
                    })
                )
            );

            return reply.code(200).send({
                result: {
                    data
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: null,
                    error: error instanceof Error ? error.message : 'Failed to import contracts'
                }
            });
        }
    });
}