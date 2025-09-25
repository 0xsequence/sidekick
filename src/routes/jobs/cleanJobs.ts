import type { Queue } from 'bull'
import type { FastifyInstance } from 'fastify'

const CleanJobsSchema = {
	description: 'Cleans the delayed, active, and waiting jobs from the queue',
	tags: ['Jobs'],
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string', nullable: true }
		}
	}
}

export async function cleanJobs(fastify: FastifyInstance) {
	fastify.post(
		'/jobs/clean',
		{ schema: CleanJobsSchema },
		async (request, reply) => {
			try {
				const rewardQueue = fastify.rewardQueue as Queue

				// Empty the queue completely
				await rewardQueue.empty()

				// Remove all repeatable jobs
				const repeatableJobs = await rewardQueue.getRepeatableJobs()
				for (const job of repeatableJobs) {
					await rewardQueue.removeRepeatableByKey(job.key)
				}

				await rewardQueue.clean(0, 'delayed')
				await rewardQueue.clean(0, 'active')
				await rewardQueue.clean(0, 'wait')

				// Clean all reward keys from Redis
				const keys = await fastify.redis.keys('rewards:*')
				if (keys.length > 0) {
					await fastify.redis.del(...keys)
				}

				return reply.code(200).send({
					result: {
						message: 'Jobs cleaned successfully'
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					error: error instanceof Error ? error.message : 'Failed to clean jobs'
				})
			}
		}
	)
}
