import type { JobId, Queue } from 'bull'
import type { FastifyInstance } from 'fastify'

type StopRewardsRequestParams = {
	chainId: string
	contractAddress: string
}

type StopRewardsResponse = {
	result?: {
		message: string
		jobId: JobId
	}
	error?: string
}

const StopRewardsSchema = {
	description: 'Stops a scheduled ERC20 token transfer job.',
	tags: ['Jobs'],
	params: {
		type: 'object',
		required: ['chainId', 'contractAddress'],
		properties: {
			chainId: { type: 'string' },
			contractAddress: { type: 'string' }
		}
	},
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string', nullable: true }
		}
	},
	response: {
		200: {
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						message: { type: 'string' },
						jobId: { type: 'number' }
					}
				},
				error: { type: 'string', nullable: true }
			}
		}
	}
}

export async function stopRewards(fastify: FastifyInstance) {
	fastify.post<{
		Params: StopRewardsRequestParams
		Reply: StopRewardsResponse
	}>(
		'/jobs/erc20/rewards/:chainId/:contractAddress/stop',
		{
			schema: StopRewardsSchema
		},
		async (request, reply) => {
			try {
				const { chainId, contractAddress } =
					request.params as StopRewardsRequestParams
				const rewardKey = `rewards:${chainId}:${contractAddress}`

				// Get job ID from Redis
				const rewardData = await fastify.redis.hgetall(rewardKey)
				if (!rewardData?.jobId) {
					return reply.code(404).send({
						error: 'No active jobs found'
					})
				}

				const rewardQueue = fastify.rewardQueue as Queue

				// Remove the repeatable job
				await rewardQueue.removeRepeatable({
					jobId: rewardData.jobId,
					every: Number.parseInt(rewardData.every) * 60 * 1000
				})

				// Remove any pending delayed jobs
				await rewardQueue.removeJobs(`${rewardData.jobId}*`)

				// Clean up Redis
				await fastify.redis.del(rewardKey)

				return reply.code(200).send({
					result: {
						message: 'Rewards distribution stopped',
						jobId: rewardData.jobId
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					error:
						error instanceof Error ? error.message : 'Failed to stop rewards'
				})
			}
		}
	)
}
