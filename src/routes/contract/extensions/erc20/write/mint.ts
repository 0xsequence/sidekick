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

type ERC20MintRequestBody = {
	to: string
	amount: string
	waitForReceipt?: boolean
}

type ERC20MintRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC20MintResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC20MintSchema = {
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

export async function erc20Mint(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC20MintRequestParams
		Body: ERC20MintRequestBody
		Reply: ERC20MintResponse
	}>(
		'/write/erc20/:chainId/:contractAddress/mint',
		{
			schema: ERC20MintSchema
		},
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId, contractAddress } = request.params

			try {
				const { to, amount, waitForReceipt } = request.body

				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				const contract = new ethers.Contract(contractAddress, erc20Abi, signer)

				const data = contract.interface.encodeFunctionData('mint', [to, amount])

				const tx = {
					to: contractAddress,
					data
				}
				logStep(request, 'Tx prepared', { tx })

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

			logStep(request, 'Sending mint transaction...')
			const txResponse: TransactionResponse = await signer.sendTransaction(tx, {waitForReceipt: waitForReceipt ?? false})
			txHash = txResponse.hash
			logStep(request, 'Mint transaction sent', { txHash: txResponse.hash })

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
					functionName: 'mint'
				})

			logStep(request, 'Mint transaction success', {
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
						: 'Failed to execute mint'
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
