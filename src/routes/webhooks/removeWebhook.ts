import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

// Types for request/response
type RemoveWebhookRequestBody = {
	webhookId: string
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
				const { webhookId } = request.body

				const indexer = indexerClient()

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
