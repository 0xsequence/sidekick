import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { PRISMA_NOT_INITIALIZED } from '~/constants/errors'
import type { Contract } from '~/lib/generated/prismaClient'
import { ContractSchema } from '~/schemas/contractSchemas'

type GetContractResponse = {
	result?: {
		data: {
			contract: Contract | null
		}
		error?: string
	}
}

type GetContractParams = {
	contractAddress: string
}

const getContractSchema = {
	tags: ['Contract'],
	response: {
		200: Type.Object({
			result: Type.Object({
				data: Type.Object({
					contract: ContractSchema
				}),
				error: Type.Optional(Type.String())
			})
		})
	}
}

export async function getContract(fastify: FastifyInstance) {
	fastify.get<{
		Reply: GetContractResponse
		Params: GetContractParams
	}>(
		'/contract/get/:contractAddress',
		{
			schema: getContractSchema
		},
		async (request, reply) => {
			try {
				const { contractAddress } = request.params

				if (!fastify.prisma) throw new Error(PRISMA_NOT_INITIALIZED)

				const contract = await fastify.prisma.contract.findUnique({
					where: {
						contractAddress
					}
				})

				return reply.code(200).send({
					result: {
						data: {
							contract
						}
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: {
							contract: null
						},
						error:
							error instanceof Error ? error.message : 'Failed to get contract'
					}
				})
			}
		}
	)
}
