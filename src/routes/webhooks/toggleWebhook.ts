import type { WebhookListener } from '@0xsequence/indexer'
import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

export type ToggleWebhookResponse = {
	result?: {
		data: {
			webhook: WebhookListener | null
		}
		error?: string
	}
}

type ToggleWebhookRequestBody = {
	webhookId: string
}

const ToggleWebhookSchema = {
	tags: ['Webhooks'],
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string' }
		},
		required: ['x-secret-key']
	},
	body: {
		type: 'object',
		properties: {
			webhookId: { type: 'string' }
		},
		required: ['webhookId']
	}
}

export async function resumeAllWebhooks(fastify: FastifyInstance) {
	fastify.post<{
		Reply: ToggleWebhookResponse
		Body: ToggleWebhookRequestBody
	}>(
		'/webhook/toggle',
		{
			schema: ToggleWebhookSchema
		},
		async (request, reply) => {
			try {
				const { webhookId } = request.body

				const indexer = indexerClient()

				if (!indexer) throw new Error('Indexer client not initialized')

				const response = await indexer.toggleWebhookListener({
					id: Number(webhookId)
				})

				return reply.code(200).send({
					result: {
						data: {
							webhook: response.webhookListener
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							webhook: null
						},
						error:
							error instanceof Error
								? error.message
								: 'Failed to toggle webhook'
					}
				})
			}
		}
	)
}
