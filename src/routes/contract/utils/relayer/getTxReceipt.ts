import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import type { TransactionReceipt, TransactionResponse } from '~/types/general'
import { logStep } from '~/utils/loggingUtils'
import { getRelayer } from '~/utils/wallet'

type RawTraceDebugResponse = {
	result: {
		hasRevertedCalls: boolean
		revertedCalls: any[]
		error?: string
	}
}

type GetTxReceiptParams = {
	chainId: string
	metaTxHash: string
}

type GetTxReceiptQuery = {
	rpcUrl?: string
	debug?: boolean
}

type GetTxReceiptResponse = {
	result?: {
		data: {
			receipt: TransactionReceipt | null
			isSuccessful: boolean | null
			hasRevertedCalls: boolean | null
			revertedCalls: any[] | null
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
	querystring: {
		type: 'object',
		properties: {
			rpcUrl: { type: 'string', description: 'RPC URL for debug calls' },
			checkForInternalReverts: {
				type: 'string',
				description: 'Whether to check for internal reverts'
			}
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
					hasRevertedCalls: Type.Union([Type.Boolean(), Type.Null()]),
					revertedCalls: Type.Union([Type.Array(Type.Any()), Type.Null()]),
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
		Querystring: GetTxReceiptQuery
		Reply: GetTxReceiptResponse
	}>(
		'/relayer/receipt/:chainId/:metaTxHash',
		{
			schema: getTxReceiptSchema
		},
		async (request, reply) => {
			try {
				const { chainId, metaTxHash } = request.params
				const { rpcUrl, debug } = request.query

				const relayer = await getRelayer(chainId)

				logStep(request, 'Waiting for transaction receipt for meta tx: ', {
					metaTxHash
				})

				const receipt: TransactionResponse = await relayer.wait(metaTxHash)

				const txHash = receipt.receipt?.transactionHash

				let debugData: RawTraceDebugResponse | null = null

				if (debug === true && txHash && rpcUrl) {
					const raw_trace_debug_response = await fastify.inject({
						method: 'GET',
						url: `/debug/${chainId}/${txHash}`,
						query: {
							rpcUrl: rpcUrl
						}
					})

					debugData = JSON.parse(raw_trace_debug_response.payload)
				}

				logStep(request, 'Transaction receipt received: ', {
					receipt: receipt.receipt
				})

				return reply.code(200).send({
					result: {
						data: {
							receipt: receipt.receipt,
							isSuccessful:
								receipt.receipt?.status === '0x1' ||
								receipt.receipt?.status === 1,
							hasRevertedCalls: debugData?.result.hasRevertedCalls || null,
							revertedCalls: debugData?.result.revertedCalls || null
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							receipt: null,
							isSuccessful: null,
							hasRevertedCalls: null,
							revertedCalls: null
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
