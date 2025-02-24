import type { FastifyInstance } from "fastify";
import type { Queue } from 'bull';

type ScheduleRewardsRequestBody = {
    users: string[];      
    amounts: string[];    
    timeframe: number;    // Time in minutes between distributions
}

type ScheduleRewardsRequestParams = {
    chainId: string;
    contractAddress: string;
}

const ScheduleRewardsSchema = {
    description: 'Schedule a task to be executed at a specific time',
    tags: ['Schedule'],
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
        required: ['x-secret-key'],
        properties: {
            'x-secret-key': { type: 'string' }
        }
    },
    body: {
        type: 'object',
        required: ['users', 'amounts', 'timeframe'],
        properties: {
            users: { 
                type: 'array',
                items: { type: 'string' }
            },
            amounts: {
                type: 'array',
                items: { type: 'string' }
            },
            timeframe: { 
                type: 'number',
                description: 'Time in minutes between distributions. Examples: 10 (10 minutes), 1440 (1 day), 10080 (1 week)'
            }
        }
    }
}

export async function scheduleRewards(fastify: FastifyInstance) {
    fastify.post<{
        Body: ScheduleRewardsRequestBody;
        Params: ScheduleRewardsRequestParams;
    }>('/erc20/schedule/:chainId/:contractAddress/transfer', {
        schema: ScheduleRewardsSchema
    }, async (request, reply) => {
        try {
            const { users, amounts, timeframe } = request.body;
            const { chainId, contractAddress } = request.params;

            if (users.length !== amounts.length) {
                return reply.code(400).send({
                    error: 'Users and amounts arrays must be the same length'
                });
            }

            const rewardQueue = fastify.rewardQueue as Queue;

            // Schedule recurring job with proper options
            const job = await rewardQueue.add(
                'reward-transfer', // Named job for better tracking
                {
                    chainId,
                    contractAddress,
                    users,
                    amounts
                },
                {
                    repeat: {
                        every: timeframe * 60 * 1000, // Convert minutes to milliseconds
                    },
                    removeOnComplete: false, // Keep completed jobs
                    removeOnFail: false // Keep failed jobs
                }
            );

            // Get the repeat job key
            const repeatableJobs = await rewardQueue.getRepeatableJobs();
            const repeatJobKey = repeatableJobs.find(
                rJob => rJob.id === 'reward-transfer' && 
                rJob.every === timeframe * 60 * 1000
            )?.key;

            // Store job ID and repeat key in Redis for later management
            const rewardKey = `rewards:${chainId}:${contractAddress}`;
            await fastify.redis.hset(rewardKey, {
                jobId: job.id,
                repeatJobKey: repeatJobKey,
                users: JSON.stringify(users),
                amounts: JSON.stringify(amounts),
                timeframe
            });

            return reply.code(200).send({
                result: {
                    message: 'Rewards distribution scheduled',
                    jobId: job.id,
                    repeatJobKey: repeatJobKey,
                    users: users.length,
                    timeframe: timeframe,
                    nextRun: new Date(Date.now() + timeframe * 60 * 1000).toISOString()
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                error: error instanceof Error ? error.message : 'Failed to start rewards'
            });
        }
    });
} 