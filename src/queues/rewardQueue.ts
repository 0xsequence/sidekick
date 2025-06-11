import Queue from 'bull'
import { ethers } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { erc20Abi } from '~/constants/abis/erc20'
import { TransactionService } from '~/services/transaction.service'
import { getSigner } from '~/utils/wallet'

interface RewardJob {
	chainId: string
	contractAddress: string
	recipients: string[]
	amounts: string[]
}

export function createRewardQueue(fastify: FastifyInstance) {
	const redisUrl = `redis://${process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : ''}${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
	const rewardQueue = new Queue<RewardJob>('rewards', redisUrl, {
		settings: {
			stalledInterval: 30000, // Check for stalled jobs every 30 seconds
			maxStalledCount: 1 // Only try to process a stalled job once
		}
	})

	// Handle stalled jobs
	rewardQueue.on('stalled', (job) => {
		fastify.log.warn(`Job ${job.id} has stalled`)
	})

	// Handle failed jobs
	rewardQueue.on('failed', (job, err) => {
		fastify.log.error(`Job ${job.id} has failed:`, err)
	})

	// Process rewards distribution
	rewardQueue.process('reward-transfer', async (job) => {
		const { chainId, contractAddress, recipients, amounts } = job.data

		try {
			// Mark job as active at start
			await job.progress(0)

			const txService = new TransactionService(fastify)
			const signer = await getSigner(chainId)
			const contract = new ethers.Contract(contractAddress, erc20Abi, signer)

			// Update progress as we go
			await job.progress(25)

			try {
				await job.progress(50)

				const txs = recipients.map((recipient, index) => {
					const data = contract.interface.encodeFunctionData('transfer', [
						recipient,
						amounts[index]
					])
					return {
						to: contractAddress,
						data
					}
				})

				await job.progress(75)

				const txResponse = await signer.sendTransaction(txs)

				const receipt = await txResponse.wait()

				if (receipt?.status === 0) {
					throw new Error('Transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc20Abi,
					data: txs[0].data,
					txHash: receipt?.hash ?? '',
					isDeployTx: false,
					args: []
				})

				// Mark job as complete
				await job.progress(100)

				// Return result for job completion
				return {
					txHash: txResponse.hash,
					status: 'success'
				}
			} catch (error) {
				fastify.log.error(
					`Failed to distribute rewards to ${recipients}:`,
					error
				)
				throw error // This will mark the job as failed
			}
		} catch (error) {
			fastify.log.error('Error processing rewards:', error)
			throw error
		}
	})

	return rewardQueue
}
