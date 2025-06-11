import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

export type ResumeAllWebhooksResponse = {
	result?: {
		status: boolean
		error?: string
	}
}

type ResumeAllWebhooksRequestBody = {
	indexerUrl: string
}

const ResumeAllWebhooksSchema = {
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
			'x-secret-key': { type: 'string' }
		},
		required: ['x-secret-key']
	}
}

export async function resumeAllWebhooks(fastify: FastifyInstance) {
	fastify.post<{
		Reply: ResumeAllWebhooksResponse
		Body: ResumeAllWebhooksRequestBody
	}>(
		'/webhook/resumeAll',
		{
			schema: ResumeAllWebhooksSchema
		},
		async (request, reply) => {
			try {
				const { indexerUrl } = request.body

				const indexer = indexerClient(indexerUrl)

				if (!indexer) throw new Error('Indexer client not initialized')

				const response = await indexer.resumeAllWebhookListeners({})

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
								: 'Failed to resume all webhooks'
					}
				})
			}
		}
	)
}
