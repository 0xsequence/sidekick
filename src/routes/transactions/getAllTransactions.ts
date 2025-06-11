import type { FastifyInstance } from 'fastify'
import { PRISMA_NOT_INITIALIZED } from '~/constants/errors'

export async function getTransactions(fastify: FastifyInstance) {
	fastify.get(
		'/transactions',
		{
			schema: {
				tags: ['Transactions'],
				summary: 'Get all transactions',
				description: 'Get all transactions from the database'
			}
		},
		async (request, reply) => {
			try {
				if (!fastify.prisma) throw new Error(PRISMA_NOT_INITIALIZED)

				const transactions = await fastify.prisma.transaction.findMany({
					orderBy: {
						createdAt: 'desc'
					}
				})

				return reply.code(200).send({
					transactions,
					fromCache: false
				})
			} catch (error) {
				console.error('Error fetching transactions:', error)
				return reply.code(500).send({
					error: 'Internal Server Error',
					message: 'Failed to fetch transactions'
				})
			}
		}
	)
}
