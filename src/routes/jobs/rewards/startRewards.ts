import type { JobId, Queue } from 'bull'
import type { FastifyInstance } from 'fastify'

type StartRewardsRequestBody = {
	recipients: string[]
	amounts: string[]
	every_x_minutes: number // Time in minutes between distributions
	repeat_count: number // how many times to repeat
}

type StartRewardsRequestParams = {
	chainId: string
	contractAddress: string
}

type StartRewardsResponse = {
	result?: {
		message: string
		jobId: JobId
		recipients: number
		every_x_minutes: number
		repeatJobKey: string | undefined
		nextRun: string
	}
	error?: string
}

const StartRewardsSchema = {
	description:
		'Schedules an ERC20 token transfer to be executed repeatedly at a specified interval.',
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
	body: {
		type: 'object',
		required: ['recipients', 'amounts', 'every_x_minutes', 'repeat_count'],
		properties: {
			recipients: {
				type: 'array',
				items: { type: 'string' }
			},
			amounts: {
				type: 'array',
				items: { type: 'string' }
			},
			every_x_minutes: {
				type: 'number',
				description:
					'Time in minutes between distributions. Examples: 10 (10 minutes), 1440 (1 day), 10080 (1 week)'
			},
			repeat_count: {
				type: 'number',
				description:
					'How many times to repeat the job. Examples: 1 (once), 2 (twice)'
			}
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
						jobId: { type: 'object' },
						recipients: { type: 'number' },
						every: { type: 'number' },
						repeatJobKey: { type: 'string', nullable: true }
					}
				},
				error: { type: 'string', nullable: true }
			}
		},
		500: {
			type: 'object',
			properties: {
				error: { type: 'string' }
			}
		}
	}
}

export async function startRewards(fastify: FastifyInstance) {
	fastify.post<{
		Body: StartRewardsRequestBody
		Params: StartRewardsRequestParams
		Reply: StartRewardsResponse
	}>(
		'/jobs/erc20/rewards/:chainId/:contractAddress/start',
		{
			schema: StartRewardsSchema
		},
		async (request, reply) => {
			try {
				const { recipients, amounts, every_x_minutes, repeat_count } =
					request.body
				const { chainId, contractAddress } = request.params

				if (recipients.length !== amounts.length) {
					return reply.code(400).send({
						error: 'Users and amounts arrays must be the same length'
					})
				}

				const rewardQueue = fastify.rewardQueue as Queue

				// Schedule recurring job
				const job = await rewardQueue.add(
					'reward-transfer',
					{
						chainId,
						contractAddress,
						recipients,
						amounts
					},
					{
						repeat: {
							every: every_x_minutes * 60 * 1000,
							limit: repeat_count
						},
						removeOnComplete: false,
						removeOnFail: false,
						attempts: 1,
						backoff: {
							type: 'exponential',
							delay: 3000
						}
					}
				)

				// Get the repeat job key
				const repeatableJobs = await rewardQueue.getRepeatableJobs()
				const repeatJobKey = repeatableJobs.find(
					(rJob) =>
						rJob.id === 'reward-transfer' &&
						rJob.every === every_x_minutes * 60 * 1000
				)?.key

				// Store job ID and repeat key in Redis for later management
				const rewardKey = `rewards:${chainId}:${contractAddress}`
				await fastify.redis.hset(rewardKey, {
					jobId: job.id,
					repeatJobKey: repeatJobKey,
					recipients: JSON.stringify(recipients),
					amounts: JSON.stringify(amounts),
					every_x_minutes: every_x_minutes
				})

				return reply.code(200).send({
					result: {
						message: 'Rewards distribution scheduled',
						jobId: job.id,
						repeatJobKey: repeatJobKey,
						recipients: recipients.length,
						every_x_minutes: every_x_minutes,
						nextRun: new Date(
							Date.now() + every_x_minutes * 60 * 1000
						).toISOString()
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					error:
						error instanceof Error ? error.message : 'Failed to start rewards'
				})
			}
		}
	)
}
