import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { erc20Abi } from '~/constants/abis/erc20'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'
import type { TransactionResponse } from '~/types/general'

type ERC20TransferRequestBody = {
	to: string
	amount: string
	waitForReceipt?: boolean
}

type ERC20TransferRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC20TransferResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC20TransferSchema = {
	tags: ['ERC20'],
	body: {
		type: 'object',
		required: ['to', 'amount'],
		properties: {
			to: { type: 'string' },
			amount: { type: 'string' },
			waitForReceipt: { type: 'boolean', nullable: true }
		}
	},
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
						txHash: { type: 'string' },
						txUrl: { type: 'string' },
						txSimulationUrl: { type: 'string', nullable: true },
						error: { type: 'string', nullable: true }
					}
				}
			}
		}
	}
}

export async function erc20Transfer(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC20TransferRequestParams
		Body: ERC20TransferRequestBody
		Reply: ERC20TransferResponse
	}>(
		'/write/erc20/:chainId/:contractAddress/transfer',
		{
			schema: ERC20TransferSchema
		},
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId, contractAddress } = request.params

			try {
				const { to, amount, waitForReceipt } = request.body

				const signer = await getSigner(chainId)
				if (!signer || !signer.account?.address) {
					logError(request, new Error('Signer not configured correctly.'), {
						signer
					})
					throw new Error('Signer not configured correctly.')
				}
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				const contract = new ethers.Contract(contractAddress, erc20Abi, signer)
				logStep(request, 'Contract instance created', { contractAddress })

				const data = contract.interface.encodeFunctionData('transfer', [
					to,
					amount
				])
				logStep(request, 'Function data encoded', { to, amount })

				const tx = {
					to: contractAddress,
					data
				}

				const { simulationData, signedTx } =
					await prepareTransactionsForTenderlySimulation(
						signer,
						[tx],
						Number(chainId)
					)
				tenderlyUrl = getTenderlySimulationUrl({
					chainId: chainId,
					gas: 3000000,
					block: await signer.provider.getBlockNumber(),
					blockIndex: 0,
					contractAddress: signedTx.entrypoint,
					rawFunctionInput: simulationData
				})

				const txService = new TransactionService(fastify)

			logStep(request, 'Sending transfer transaction...')
			const txResponse: TransactionResponse = await signer.sendTransaction(tx, {waitForReceipt: waitForReceipt ?? false})
			txHash = txResponse.hash
			logStep(request, 'Transfer transaction sent', {
				txHash: txResponse.hash
			})

			if (txResponse.receipt?.status === 0) {
				throw new Error('Transaction reverted', { cause: txResponse.receipt })
			}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc20Abi,
					data: tx.data,
					txHash: txHash,
					isDeployTx: false,
					args: [to, amount],
					functionName: 'transfer'
				})

			logStep(request, 'Transfer transaction success', {
				txHash: txHash
			})
			return reply.code(200).send({
				result: {
					txHash: txHash,
					txUrl: getBlockExplorerUrl(Number(chainId), txHash),
					txSimulationUrl: tenderlyUrl ?? null
				}
			})
			} catch (error) {
				// Extract transaction hash from error receipt if available
				const errorTxHash = extractTxHashFromErrorReceipt(error)
				const finalTxHash = txHash ?? errorTxHash

				logError(request, error, {
					params: request.params,
					body: request.body,
					txHash: finalTxHash
				})

				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to execute transfer'
				return reply.code(500).send({
					result: {
						txHash: finalTxHash,
						txUrl: finalTxHash ? getBlockExplorerUrl(Number(chainId), finalTxHash) : null,
						txSimulationUrl: tenderlyUrl ?? null,
						error: errorMessage
					}
				})
			}
		}
	)
}
