import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

export type PauseAllWebhooksResponse = {
	result?: {
		status: boolean
		error?: string
	}
}

const PauseAllWebhooksSchema = {
	tags: ['Webhooks'],
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string' }
		},
		required: ['x-secret-key']
	}
}

export async function pauseAllWebhooks(fastify: FastifyInstance) {
	fastify.post<{
		Reply: PauseAllWebhooksResponse
	}>(
		'/webhook/pauseAll',
		{
			schema: PauseAllWebhooksSchema
		},
		async (request, reply) => {
			try {
				const indexer = indexerClient()

				if (!indexer) throw new Error('Indexer client not initialized')

				const response = await indexer.pauseAllWebhookListeners({})

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
								: 'Failed to pause all webhooks'
					}
				})
			}
		}
	)
}
