import type { WebhookListener } from '@0xsequence/indexer'
import type { FastifyInstance } from 'fastify'
import { indexerClient } from '~/clients/indexerClient'

// Types for request/response
type AddWebhookRequestBody = {
	url: string
	events: string[]
	contractAddresses: string[]
	indexerUrl: string
}

export type AddWebhookResponse = {
	result?: {
		data: {
			webhook: WebhookListener | null
			status: boolean
		}
		error?: string
	}
}

const AddWebhookSchema = {
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
			url: { type: 'string' },
			events: { type: 'array', items: { type: 'string' } },
			contractAddresses: { type: 'array', items: { type: 'string' } },
			indexerUrl: { type: 'string' }
		},
		required: ['url', 'events', 'contractAddresses']
	},
	response: {
		200: {
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						data: {
							type: 'object',
							properties: {
								webhook: {
									type: 'object',
									nullable: true,
									properties: {
										id: { type: 'string' },
										url: { type: 'string' },
										filters: {
											type: 'object',
											properties: {
												contractAddresses: {
													type: 'array',
													items: { type: 'string' }
												},
												events: {
													type: 'array',
													items: { type: 'string' }
												}
											}
										}
									}
								},
								status: { type: 'boolean' }
							}
						},
						error: { type: 'string' }
					}
				}
			}
		}
	}
}

export async function addWebhook(fastify: FastifyInstance) {
	fastify.post<{
		Body: AddWebhookRequestBody
		Reply: AddWebhookResponse
	}>(
		'/webhook/add',
		{
			schema: AddWebhookSchema
		},
		async (request, reply) => {
			try {
				const { url, events, contractAddresses, indexerUrl } = request.body

				const indexer = indexerClient(indexerUrl)

				if (!indexer) throw new Error('Indexer client not initialized')

				const response = await indexer.addWebhookListener({
					url,
					filters: {
						contractAddresses,
						events
					}
				})

				// Add logging to see what we're getting back
				console.log('Indexer Response:', JSON.stringify(response, null, 2))

				return reply.code(200).send({
					result: {
						data: {
							webhook: response.listener,
							status: response.status
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							webhook: null,
							status: false
						},
						error:
							error instanceof Error ? error.message : 'Failed to add webhook'
					}
				})
			}
		}
	)
}
