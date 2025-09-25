import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import type { TransactionResponse } from '~/types/general'
import { logStep } from '~/utils/loggingUtils'
import { getRelayer } from '~/utils/wallet'

type GetTxHashForMetaTxHashParams = {
	chainId: string
	metaTxHash: string
}

type GetTxHashForMetaTxHashResponse = {
	result?: {
		data: {
			txHash: string | null
		}
		error?: string
	}
}

const getTxHashForMetaTxHashSchema = {
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
					txHash: Type.String()
				})
			}),
			error: Type.Optional(Type.String())
		}),
		500: Type.Object({
			result: Type.Object({
				data: Type.Object({
					txHash: Type.Null()
				}),
				error: Type.String()
			})
		})
	}
}

export async function getTxHashForMetaTxHash(fastify: FastifyInstance) {
	fastify.get<{
		Params: GetTxHashForMetaTxHashParams
		Reply: GetTxHashForMetaTxHashResponse
	}>(
		'/relayer/txHashForMetaTxHash/:chainId/:metaTxHash',
		{
			schema: getTxHashForMetaTxHashSchema
		},
		async (request, reply) => {
			try {
				const { chainId, metaTxHash } = request.params
				const relayer = await getRelayer(chainId)

				logStep(request, 'Waiting for transaction receipt for meta tx: ', {
					metaTxHash
				})

				const receipt: TransactionResponse = await relayer.wait(metaTxHash)

				const txHash = receipt.receipt?.transactionHash

				logStep(request, 'Tx hash received: ', {
					txHash
				})

				return reply.code(200).send({
					result: {
						data: {
							txHash
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							txHash: null
						},
						error:
							error instanceof Error
								? error.message
								: 'Failed to get transaction hash'
					}
				})
			}
		}
	)
}
