import { ethers } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { erc721Abi } from 'viem'
import { getSigner } from '../../../../../utils/wallet'

type ERC721BalanceOfRequestQuery = {
	owner: string
}

type ERC721BalanceOfRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC721BalanceOfResponse = {
	result?: {
		data: unknown
		error?: string
	}
}

const ERC721BalanceOfSchema = {
	tags: ['ERC721'],
	params: {
		type: 'object',
		required: ['chainId', 'contractAddress'],
		properties: {
			chainId: { type: 'string' },
			contractAddress: { type: 'string' }
		}
	},
	query: {
		type: 'object',
		required: ['owner'],
		properties: {
			owner: { type: 'string' }
		}
	},
	response: {
		200: {
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						data: { type: 'string' },
						error: { type: 'string', nullable: true }
					}
				}
			}
		}
	}
}

export async function erc721BalanceOf(fastify: FastifyInstance) {
	fastify.get<{
		Params: ERC721BalanceOfRequestParams
		Querystring: ERC721BalanceOfRequestQuery
		Reply: ERC721BalanceOfResponse
	}>(
		'/read/erc721/:chainId/:contractAddress/balanceOf',
		{
			schema: ERC721BalanceOfSchema
		},
		async (request, reply) => {
			try {
				const { chainId, contractAddress } = request.params
				const { owner } = request.query

				const provider = await getSigner(chainId)
				const contract = new ethers.Contract(
					contractAddress,
					erc721Abi,
					provider
				)

				const data = await contract.balanceOf(owner)
				console.log('Balance of ', owner, ' is ', data)

				return reply.code(200).send({
					result: {
						data: data.toString()
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						data: null,
						error:
							error instanceof Error ? error.message : 'Failed to read balance'
					}
				})
			}
		}
	)
}
