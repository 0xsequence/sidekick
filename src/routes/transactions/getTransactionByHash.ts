import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { PRISMA_NOT_INITIALIZED } from '~/constants/errors'
import { TransactionSchema } from '../../schemas/transactionSchemas'

type GetTransactionByHashParams = {
	txHash: string
}

type GetTransactionByHashResponse = {
	result?: {
		data: {
			transaction: unknown
		}
		error?: string
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

export async function getTransactionByHash(fastify: FastifyInstance) {
	fastify.get<{
		Params: GetTransactionByHashParams
		Reply: GetTransactionByHashResponse
	}>(
		'/transactions/:txHash',
		{
			schema: getTransactionByHashSchema
		},
		async (request, reply) => {
			try {
				const { txHash } = request.params

				if (!fastify.prisma) throw new Error(PRISMA_NOT_INITIALIZED)

				const transaction = await fastify.prisma.transaction.findFirst({
					where: {
						hash: txHash
					}
				})

				return reply.code(200).send({
					result: {
						data: {
							transaction
						}
					}
				})
			} catch (error) {
				console.error('Error fetching transaction:', error)
				return reply.code(500).send({
					result: {
						data: {
							transaction: null
						},
						error:
							error instanceof Error
								? error.message
								: 'Failed to fetch transaction'
					}
				})
			}
		}
	)
}
