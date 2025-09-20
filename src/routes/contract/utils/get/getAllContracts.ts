import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { PRISMA_NOT_INITIALIZED } from '~/constants/errors'
import type { Contract } from '~/lib/generated/prismaClient'
import { ContractSchema } from '~/schemas/contractSchemas'

type GetAllContractsResponse = {
	result?: {
		data: {
			contracts: Array<Contract>
		}
		error?: string
	}
}

const getAllContractsSchema = {
	tags: ['Contract'],
	response: {
		200: Type.Object({
			result: Type.Object({
				data: Type.Object({
					contracts: Type.Array(ContractSchema)
				}),
				error: Type.Optional(Type.String())
			})
		})
	}
}

export async function getAllContracts(fastify: FastifyInstance) {
	fastify.get<{
		Reply: GetAllContractsResponse
	}>(
		'/contract/getAll',
		{
			schema: getAllContractsSchema
		},
		async (request, reply) => {
			try {
				console.log('fastify.prisma', fastify.prisma)
				if (!fastify.prisma) throw new Error(PRISMA_NOT_INITIALIZED)

				const contracts = await fastify.prisma.contract.findMany()

				return reply.code(200).send({
					result: {
						data: {
							contracts
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							contracts: []
						},
						error:
							error instanceof Error
								? error.message
								: 'Failed to get all contracts'
					}
				})
			}
		}
	)
}
