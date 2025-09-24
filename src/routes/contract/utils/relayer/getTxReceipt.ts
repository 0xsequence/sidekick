import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { getRelayer } from '~/utils/wallet'

type GetTxReceiptParams = {
	chainId: string
	metaTxHash: string
}

type GetTxReceiptResponse = {
	result?: {
		data: {
			receipt: unknown
		}
		error?: string
	}
}

const getTxReceiptSchema = {
	tags: ['Relayer'],
	params: {
		type: 'object',
		required: ['chainId', 'metaTxHash'],
		properties: {
			chainId: { type: 'string', description: 'Chain ID' },
			metaTxHash: { type: 'string', description: 'Meta transaction hash' }
		}
	},
	response: {
		200: Type.Object({
			result: Type.Object({
				data: Type.Object({
					receipt: Type.Any()
				}),
				error: Type.Optional(Type.String())
			})
		})
	}
}

export async function getTxReceipt(fastify: FastifyInstance) {
	fastify.get<{
		Params: GetTxReceiptParams
		Reply: GetTxReceiptResponse
	}>(
		'/relayer/receipt/:chainId/:metaTxHash',
		{
			schema: getTxReceiptSchema
		},
		async (request, reply) => {
			try {
				const { chainId, metaTxHash } = request.params

				// Get the relayer for the specified chain
				const relayer = await getRelayer(chainId)

				// Wait for the transaction to be mined and get the receipt
				const receipt = await relayer.wait(metaTxHash)

				return reply.code(200).send({
					result: {
						data: {
							receipt
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							receipt: null
						},
						error:
							error instanceof Error
								? error.message
								: 'Failed to get transaction receipt'
					}
				})
			}
		}
	)
}
