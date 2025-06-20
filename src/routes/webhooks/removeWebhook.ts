import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

// Types for request/response
type RemoveWebhookRequestBody = {
	webhookId: string
	indexerUrl: string
}

export type RemoveWebhookResponse = {
	result?: {
		status: boolean
		error?: string
	}
}

const RemoveWebhookSchema = {
	tags: ['Webhooks'],
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string', nullable: true }
		}
	},
	body: {
		type: 'object',
		properties: {
			webhookId: { type: 'string' },
			indexerUrl: { type: 'string' }
		},
		required: ['webhookId', 'indexerUrl']
	}
}

export async function removeWebhook(fastify: FastifyInstance) {
	fastify.post<{
		Body: RemoveWebhookRequestBody
		Reply: RemoveWebhookResponse
	}>(
		'/webhook/remove',
		{
			schema: RemoveWebhookSchema
		},
		async (request, reply) => {
			try {
				const { webhookId, indexerUrl } = request.body

				const indexer = indexerClient(indexerUrl)

				if (!indexer) throw new Error('Indexer client not initialized')

				const response = await indexer.removeWebhookListener({
					id: Number(webhookId)
				})

				return reply.code(200).send({
					result: {
						status: response.status
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						status: false,
						error:
							error instanceof Error
								? error.message
								: 'Failed to remove webhook'
					}
				})
			}
		}
	)
}
