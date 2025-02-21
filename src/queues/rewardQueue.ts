import Queue from 'bull';
import type { FastifyInstance } from 'fastify';
import { TransactionService } from '../services/transaction.service';
import { ethers } from 'ethers';
import { erc20Abi } from '../constants/abis/erc20';
import { getSigner } from '../utils/wallet';

interface RewardJob {
    chainId: string;
    contractAddress: string;
    recipients: string[];
    amounts: string[];
}

export function createRewardQueue(fastify: FastifyInstance) {
    const rewardQueue = new Queue<RewardJob>('rewards', {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD
        },
        settings: {
            stalledInterval: 30000, // Check for stalled jobs every 30 seconds
            maxStalledCount: 1,     // Only try to process a stalled job once
        }
    });

    // Handle stalled jobs
    rewardQueue.on('stalled', (job) => {
        fastify.log.warn(`Job ${job.id} has stalled`);
    });

    // Handle failed jobs
    rewardQueue.on('failed', (job, err) => {
        fastify.log.error(`Job ${job.id} has failed:`, err);
    });

    // Process rewards distribution
    rewardQueue.process('reward-transfer', async (job) => {
        const { chainId, contractAddress, recipients, amounts } = job.data;

        try {
            // Mark job as active at start
            await job.progress(0);
            
            const txService = new TransactionService(fastify);
            const signer = await getSigner(chainId);
            const contract = new ethers.Contract(contractAddress, erc20Abi, signer);

            // Update progress as we go
            await job.progress(25);

            try {
                const pendingTx = await txService.createPendingTransaction({
                    chainId,
                    contractAddress,
                    data: {
                        functionName: 'transfer (batch)',
                        args: [recipients, amounts]
                    }
                });

                await job.progress(50);

                const txs = recipients.map((recipient, index) => {
                    const data = contract.interface.encodeFunctionData(
                        'transfer',
                        [recipient, amounts[index]]
                    );
                    return {
                        to: contractAddress,
                        data
                    }
                });

                await job.progress(75);

                const txResponse = await signer.sendTransaction(txs);
                await txService.updateTransactionStatus(pendingTx.id, txResponse);
                
                // Mark job as complete
                await job.progress(100);

                // Return result for job completion
                return {
                    txHash: txResponse.hash,
                    status: 'success'
                };

            } catch (error) {
                fastify.log.error(`Failed to distribute rewards to ${recipients}:`, error);
                throw error; // This will mark the job as failed
            }
        } catch (error) {
            fastify.log.error('Error processing rewards:', error);
            throw error;
        }
    });

    return rewardQueue;
}