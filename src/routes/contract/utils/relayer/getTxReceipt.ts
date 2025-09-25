import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import type { TransactionReceipt, TransactionResponse } from '~/types/general'
import { logStep } from '~/utils/loggingUtils'
import { getRelayer } from '~/utils/wallet'

type GetTxReceiptParams = {
	chainId: string
	metaTxHash: string
}

type GetTxReceiptResponse = {
	result?: {
		data: {
			receipt: TransactionReceipt | null
			isSuccessful: boolean | null
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
					receipt: Type.Object({
						type: Type.String(),
						root: Type.String(),
						status: Type.String(),
						cumulativeGasUsed: Type.String(),
						logsBloom: Type.String(),
						logs: Type.Optional(
							Type.Array(
								Type.Object({
									address: Type.String(),
									topics: Type.Array(Type.String()),
									data: Type.String(),
									blockNumber: Type.String(),
									transactionHash: Type.String(),
									transactionIndex: Type.String(),
									blockHash: Type.String(),
									logIndex: Type.String(),
									removed: Type.Boolean()
								})
							)
						),
						transactionHash: Type.String(),
						contractAddress: Type.String(),
						gasUsed: Type.String(),
						effectiveGasPrice: Type.String(),
						blockHash: Type.String(),
						blockNumber: Type.String(),
						transactionIndex: Type.String()
					}),
					isSuccessful: Type.Boolean()
				}),
				error: Type.Optional(Type.String())
			})
		}),
		500: Type.Object({
			result: Type.Object({
				data: Type.Object({
					receipt: Type.Null(),
					isSuccessful: Type.Null()
				}),
				error: Type.String()
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

				const relayer = await getRelayer(chainId)

				logStep(request, 'Waiting for transaction receipt for meta tx: ', {
					metaTxHash
				})

				const receipt: TransactionResponse = await relayer.wait(metaTxHash)

				logStep(request, 'Transaction receipt received: ', {
					receipt: receipt.receipt
				})

				return reply.code(200).send({
					result: {
						data: {
							receipt: receipt.receipt,
							isSuccessful:
								receipt.receipt?.status === '0x1' ||
								receipt.receipt?.status === 1
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							receipt: null,
							isSuccessful: null
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
