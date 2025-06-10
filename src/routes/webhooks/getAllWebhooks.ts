import type { WebhookListener } from '@0xsequence/indexer'
import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

export type GetAllWebhooksResponse = {
	result?: {
		data: {
			webhooks: WebhookListener[]
		}
		error?: string
	}
}

const GetAllWebhooksSchema = {
	tags: ['Webhooks'],
	response: {
		200: {
			type: 'object',
			properties: {
				result: {
					type: 'object'
				}
			}
		}
	}
}

export async function getAllWebhooks(fastify: FastifyInstance) {
	fastify.get<{
		Reply: GetAllWebhooksResponse
	}>(
		'/webhook/getAll',
		{ schema: GetAllWebhooksSchema },
		async (request, reply) => {
			try {
				const indexer = indexerClient()

				if (!indexer) throw new Error('Indexer client not initialized')

				const response = await indexer.getAllWebhookListeners({})

				return reply.code(200).send({
					result: {
						data: {
							webhooks: response.listeners
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							webhooks: []
						},
						error:
							error instanceof Error
								? error.message
								: 'Failed to get all webhooks'
					}
				})
			}
		}
	)
}
