import type { JobId, Queue } from 'bull'
import type { FastifyInstance } from 'fastify'

type GetJobsReply = {
	result?: {
		jobs: {
			id: JobId
			data: {
				chainId: string
				contractAddress: string
				recipients: string[]
				amounts: string[]
			}
			progress: number
			timestamp: number
			finishedOn: number | undefined
			processedOn: number | undefined
			failedReason: string | undefined
			opts: unknown
		}[]
	}
	error?: string
}

type GetJobsQuerystring = {
	status?: 'active' | 'completed' | 'failed' | 'delayed' | 'waiting' | 'paused'
}

const GetJobsSchema = {
	description: 'Get all jobs from the queue',
	tags: ['Jobs'],
	querystring: {
		type: 'object',
		properties: {
			status: {
				type: 'string',
				enum: ['active', 'completed', 'failed', 'delayed', 'waiting', 'paused'],
				description: 'Filter jobs by status'
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
						jobs: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string' },
									data: {
										type: 'object',
										properties: {
											chainId: { type: 'string' },
											contractAddress: { type: 'string' },
											recipients: { type: 'array', items: { type: 'string' } },
											amounts: { type: 'array', items: { type: 'string' } }
										}
									},
									progress: { type: 'number' },
									timestamp: { type: 'number' },
									finishedOn: { type: 'number' },
									processedOn: { type: 'number' },
									failedReason: { type: 'string' },
									opts: {
										type: 'object',
										properties: {
											timestamp: { type: 'number' },
											repeat: {
												type: 'object',
												properties: {
													every: { type: 'number' },
													limit: { type: 'number' }
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
}

const GetJobSchema = {
	description: 'Get a specific job by ID',
	tags: ['Jobs'],
	params: {
		type: 'object',
		properties: {
			jobId: { type: 'string' }
		}
	},
	response: {
		200: {
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						data: { type: 'object' },
						status: { type: 'string' },
						progress: { type: 'number' },
						timestamp: { type: 'number' },
						finishedOn: { type: 'number' },
						processedOn: { type: 'number' },
						failedReason: { type: 'string' },
						opts: { type: 'object' }
					}
				}
			}
		}
	}
}

export async function getJobs(fastify: FastifyInstance) {
	fastify.get<{
		Reply: GetJobsReply
		Querystring: GetJobsQuerystring
	}>(
		'/jobs',
		{
			schema: GetJobsSchema
		},
		async (request, reply) => {
			try {
				const rewardQueue = fastify.rewardQueue as Queue
				const { status } = request.query as { status?: string }

				let jobs: any[]
				switch (status) {
					case 'active':
						jobs = await rewardQueue.getActive()
						break
					case 'completed':
						jobs = await rewardQueue.getCompleted()
						break
					case 'failed':
						jobs = await rewardQueue.getFailed()
						break
					case 'delayed':
						jobs = await rewardQueue.getDelayed()
						break
					case 'waiting':
						jobs = await rewardQueue.getWaiting()
						break
					default:
						// Get all jobs if no status specified
						jobs = await rewardQueue.getJobs([
							'active',
							'completed',
							'failed',
							'delayed',
							'waiting',
							'paused'
						])
				}

				return reply.code(200).send({
					result: {
						jobs: jobs.map((job) => ({
							id: job.id,
							data: job.data,
							progress: job.progress(),
							timestamp: job.timestamp,
							finishedOn: job.finishedOn,
							processedOn: job.processedOn,
							failedReason: job.failedReason,
							opts: job.opts
						}))
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					error: error instanceof Error ? error.message : 'Failed to get jobs'
				})
			}
		}
	)

	// Get a specific job by ID
	fastify.get(
		'/jobs/:jobId',
		{
			schema: GetJobSchema
		},
		async (request, reply) => {
			try {
				const { jobId } = request.params as { jobId: string }
				const rewardQueue = fastify.rewardQueue as Queue

				const job = await rewardQueue.getJob(jobId)
				if (!job) {
					return reply.code(404).send({
						error: 'Job not found'
					})
				}

				return reply.code(200).send({
					result: {
						id: job.id,
						data: job.data,
						status: await job.getState(),
						progress: job.progress(),
						timestamp: job.timestamp,
						finishedOn: job.finishedOn,
						processedOn: job.processedOn,
						failedReason: job.failedReason,
						opts: job.opts
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					error: error instanceof Error ? error.message : 'Failed to get job'
				})
			}
		}
	)
}
