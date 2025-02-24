import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { Type } from '@sinclair/typebox';
import { TransactionSchema } from '../../schemas/transactionSchemas';
import type { Transaction } from '@prisma/client';

type GetTransactionByHashParams = {
    txHash: string;
}

type GetTransactionByHashResponse = {
    result?: {
        data: {
            transaction: Transaction | null;
        }
        error?: string;
    }
}

const getTransactionByHashSchema = {
    tags: ['Transactions'],
    params: {
        type: 'object',
        required: ['txHash'],
        properties: {
            txHash: { type: 'string' }
        }
    },
    response: {
        200: Type.Object({
            result: Type.Object({
                data: Type.Object({
                    transaction: TransactionSchema
                }),
                error: Type.Optional(Type.String())
            })
        })
    }
}

export async function getTransactionByHash(fastify: FastifyInstance) 
{
    fastify.get<{
        Params: GetTransactionByHashParams;
        Reply: GetTransactionByHashResponse;
    }>('/transactions/:txHash', {
        schema: getTransactionByHashSchema
    }, async (request, reply) => {
        try {
            const { txHash } = request.params;
            const transaction = await prisma.transaction.findFirst({
                where: {
                    hash: txHash
                }
            });

            return reply.code(200).send({
                result: {
                    data: {
                        transaction
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching transaction:', error);
            return reply.code(500).send({
                result: {
                    data: {
                        transaction: null
                    },
                    error: error instanceof Error ? error.message : 'Failed to fetch transaction'
                }
            });
        }
    });
}
