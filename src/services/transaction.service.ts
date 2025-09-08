import type { TransactionResponse } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { encodeFunctionData } from 'viem'
import { PRISMA_NOT_INITIALIZED } from '~/constants/errors'
import type { Transaction } from '~/lib/generated/prismaClient'
import { getSigner } from '../utils/wallet'

export class TransactionService {
	constructor(private fastify: FastifyInstance) {}

	async createTransaction(params: {
		chainId: string
		contractAddress: string
		abi: Array<unknown>
		txHash?: string | undefined
		data?: string | undefined
		functionName?: string | undefined
		args?: Array<string> | undefined
		isDeployTx?: boolean
	}): Promise<Transaction | null> {
		if (!process.env.DATABASE_URL) {
			this.fastify.log.warn('DATABASE_URL is not set, skipping adding to db')
			return null
		}

		const signer = await getSigner(params.chainId)

		let encodedData: string | undefined
		if (!params.data) {
			encodedData = encodeFunctionData({
				abi: params.abi,
				functionName: params.functionName ?? '',
				args: params.args ?? []
			})
		}

		const pendingTx = await this.fastify.prisma.transaction.create({
			data: {
				hash: params.txHash ?? '',
				chainId: Number(params.chainId),
				from: await signer.getAddress(),
				to: params.contractAddress,
				data: params.data ?? encodedData ?? '',
				status: 'done',
				argsJson: JSON.stringify(params.args),
				functionName: params.functionName ?? '',
				isDeployTx: params.isDeployTx ?? false
			}
		})

		this.fastify.log.info(`Transaction added to db: ${params.txHash}`)

		return pendingTx
	}

	async createPendingTransaction(params: {
		chainId: string
		contractAddress: string
		data: {
			functionName: string
			args: Array<string>
		}
	}): Promise<Transaction | null> {
		if (!process.env.DATABASE_URL) {
			this.fastify.log.warn('DATABASE_URL is not set, skipping adding to db')
			return null
		}

		const signer = await getSigner(params.chainId)

		const pendingTx = await this.fastify.prisma.transaction.create({
			data: {
				hash: '',
				chainId: Number(params.chainId),
				from: await signer.getAddress(),
				to: params.contractAddress,
				data: '',
				status: 'pending',
				argsJson: JSON.stringify(params.data.args),
				functionName: params.data.functionName
			}
		})

		return pendingTx
	}

	async updateTransactionStatus(
		txId: string,
		txResponse: TransactionResponse
	): Promise<string | null> {
		if (!process.env.DATABASE_URL) {
			this.fastify.log.warn(
				'DATABASE_URL is not set or txId is not set, skipping updating transaction status'
			)
			return null
		}

		try {
			const receipt = await txResponse.wait()
			const status = receipt?.status === 1 ? 'done' : 'failed'

			if (!this.fastify.prisma) throw new Error(PRISMA_NOT_INITIALIZED)

			await this.fastify.prisma.transaction.update({
				where: { id: txId },
				data: {
					hash: txResponse.hash,
					data: txResponse.data,
					status: status
				}
			})

			return status
		} catch (error) {
			await this.fastify.prisma.transaction.update({
				where: { id: txId },
				data: {
					hash: txResponse.hash,
					data: txResponse.data,
					status: 'failed'
				}
			})
			throw error
		}
	}
}
