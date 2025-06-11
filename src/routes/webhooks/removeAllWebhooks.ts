import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

export type RemoveAllWebhooksResponse = {
	result?: {
		status: boolean
		error?: string
	}
}

type RemoveAllWebhooksRequestBody = {
	indexerUrl: string
}

const RemoveAllWebhooksSchema = {
	tags: ['Webhooks'],
	body: {
		type: 'object',
		properties: {
			indexerUrl: { type: 'string' }
		},
		required: ['indexerUrl']
	},
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string', nullable: true }
		}
	}
}

export async function removeAllWebhooks(fastify: FastifyInstance) {
	fastify.post<{
		Reply: RemoveAllWebhooksResponse
		Body: RemoveAllWebhooksRequestBody
	}>(
		'/webhook/removeAll',
		{
			schema: RemoveAllWebhooksSchema
		},
		async (request, reply) => {
			try {
				const { indexerUrl } = request.body

				const indexer = indexerClient(indexerUrl)

				if (!indexer) throw new Error('Indexer client not initialized')

				const response = await indexer.removeAllWebhookListeners({})

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
								: 'Failed to remove all webhooks'
					}
				})
			}
		}
	)
}
