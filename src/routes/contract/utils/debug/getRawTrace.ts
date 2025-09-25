import { Type } from '@sinclair/typebox'
import { ethers } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { logger } from '~/utils/logger'

type DebugTraceTransactionParams = {
	chainId: string
	txHash: string
}

type DebugTraceTransactionQuery = {
	rpcUrl: string
}

type DebugTraceResponse = {
	result: {
		trace: any
		error?: string
	}
}

const debugTraceTransactionSchema = {
	description: 'Get the raw trace of a transaction.',
	tags: ['Debug', 'Contract'],
	params: Type.Object({
		chainId: Type.String({ description: 'Chain ID for the transaction' }),
		txHash: Type.String({ description: 'Transaction hash to trace' })
	}),
	querystring: Type.Object({
		rpcUrl: Type.String({ description: 'RPC URL for the blockchain network' })
	}),
	response: {
		200: Type.Object({
			result: Type.Object({
				trace: Type.Any(),
				error: Type.Optional(Type.String())
			})
		}),
		'4xx': Type.Object({
			result: Type.Object({
				trace: Type.Null(),
				error: Type.String()
			})
		}),
		500: Type.Object({
			result: Type.Object({
				trace: Type.Null(),
				error: Type.String()
			})
		})
	}
}

export async function getRawTrace(fastify: FastifyInstance) {
	fastify.get<{
		Params: DebugTraceTransactionParams
		Querystring: DebugTraceTransactionQuery
		Reply: DebugTraceResponse
	}>(
		'/debug/getRawTrace/:chainId/:txHash',
		{
			schema: debugTraceTransactionSchema
		},
		async (request, reply) => {
			try {
				const { chainId, txHash } = request.params
				const { rpcUrl } = request.query

				// Validate transaction hash format.
				if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
					return reply.code(400).send({
						result: { trace: null, error: 'Invalid transaction hash format.' }
					})
				}

				const provider = new ethers.JsonRpcProvider(
					rpcUrl,
					Number.parseInt(chainId, 10)
				)
				logger.info(
					`Debug tracing transaction ${txHash} on chain ${chainId} using RPC ${rpcUrl}`
				)

				const rawTrace = await provider.send('debug_traceTransaction', [
					txHash,
					{ tracer: 'callTracer' }
				])

				return reply.code(200).send({
					result: {
						trace: rawTrace || null
					}
				})
			} catch (error: any) {
				request.log.error(error)
				logger.error(
					`Error tracing transaction ${request.params.txHash}: ${error}`
				)

				return reply.code(500).send({
					result: {
						trace: null,
						error:
							error instanceof Error
								? error.message
								: 'Failed to trace transaction due to an unknown error.'
					}
				})
			}
		}
	)
}
