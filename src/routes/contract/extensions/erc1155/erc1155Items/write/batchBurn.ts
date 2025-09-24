import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { erc1155ItemsAbi } from '~/constants/abis/erc1155Items'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'
import type { TransactionResponse } from '~/types/general'

type ERC1155ItemsBatchBurnRequestBody = {
	tokenIds: string[]
	amounts: string[]
	waitForReceipt?: boolean
}

type ERC1155ItemsBatchBurnRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC1155ItemsBatchBurnResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC1155ItemsBatchBurnSchema = {
	tags: ['ERC1155Items'],
	body: {
		type: 'object',
		required: ['tokenIds', 'amounts'],
		properties: {
			tokenIds: { type: 'array', items: { type: 'string' } },
			amounts: { type: 'array', items: { type: 'string' } },
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

export async function erc1155ItemsBatchBurn(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC1155ItemsBatchBurnRequestParams
		Body: ERC1155ItemsBatchBurnRequestBody
		Reply: ERC1155ItemsBatchBurnResponse
	}>(
		'/write/erc1155Items/:chainId/:contractAddress/batchBurn',
		{ schema: ERC1155ItemsBatchBurnSchema },
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId, contractAddress } = request.params

			try {
				const { tokenIds, amounts, waitForReceipt } = request.body

				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				const contract = new ethers.Contract(
					contractAddress,
					erc1155ItemsAbi,
					signer
				)

				// Convert string arrays to BigInt arrays for the contract call
				const tokenIdsBigInt = tokenIds.map((id) => BigInt(id))
				const amountsBigInt = amounts.map((a) => BigInt(a))

				const callData = contract.interface.encodeFunctionData('batchBurn', [
					tokenIdsBigInt,
					amountsBigInt
				])

				const tx = {
					to: contractAddress,
					data: callData
				}
				logStep(request, 'Tx prepared', { tx })

				const { simulationData, signedTx } =
					await prepareTransactionsForTenderlySimulation(
						signer,
						[tx],
						Number(chainId)
					)
				const tenderlyUrl = getTenderlySimulationUrl({
					chainId: chainId,
					gas: 3000000,
					block: await signer.provider.getBlockNumber(),
					blockIndex: 0,
					contractAddress: signedTx.entrypoint,
					rawFunctionInput: simulationData
				})

				const txService = new TransactionService(fastify)

			logStep(request, 'Sending batchBurn transaction...')
			const txResponse: TransactionResponse = await signer.sendTransaction(tx, {waitForReceipt: waitForReceipt ?? false})
			txHash = txResponse.hash
			logStep(request, 'BatchBurn transaction sent', { txResponse })

			if (txResponse.receipt?.status === 0) {
				throw new Error('Transaction reverted', { cause: txResponse.receipt })
			}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc1155ItemsAbi,
					data: tx.data,
					txHash: txHash,
					isDeployTx: false,
					args: [JSON.stringify(tokenIds), JSON.stringify(amounts)],
					functionName: 'batchBurn'
				})

				logStep(request, 'Batch burn transaction success', {
					txHash: txResponse.hash
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
						: 'Failed to batchBurn ERC1155Items'
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
