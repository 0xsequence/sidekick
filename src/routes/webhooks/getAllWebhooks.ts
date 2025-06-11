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

type GetAllWebhooksRequestBody = {
	indexerUrl: string
}

const GetAllWebhooksSchema = {
	tags: ['Webhooks'],
	querystring: {
		type: 'object',
		properties: {
			indexerUrl: { type: 'string' }
		},
		required: ['indexerUrl']
	},
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
		Querystring: GetAllWebhooksRequestBody
	}>(
		'/webhook/getAll',
		{ schema: GetAllWebhooksSchema },
		async (request, reply) => {
			try {
				const { indexerUrl } = request.query

				const indexer = indexerClient(indexerUrl)

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
