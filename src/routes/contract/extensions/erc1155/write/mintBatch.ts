import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { erc1155Abi } from '~/constants/abis/erc1155'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'
import type { TransactionResponse } from '~/types/general'

type ERC1155MintBatchRequestBody = {
	recipients: string[]
	ids: string[]
	amounts: string[]
	datas: string[]
	waitForReceipt?: boolean
}

type ERC1155MintBatchRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC1155MintBatchResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC1155MintBatchSchema = {
	tags: ['ERC1155'],
	body: {
		type: 'object',
		required: ['recipients', 'ids', 'amounts', 'datas'],
		properties: {
			recipients: { type: 'array', items: { type: 'string' } },
			ids: { type: 'array', items: { type: 'string' } },
			amounts: { type: 'array', items: { type: 'string' } },
			datas: { type: 'array', items: { type: 'string' } },
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
		},
		500: {
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						txHash: { type: 'string', nullable: true },
						txUrl: { type: 'string', nullable: true },
						error: { type: 'string' }
					}
				}
			}
		}
	}
}

export async function erc1155MintBatch(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC1155MintBatchRequestParams
		Body: ERC1155MintBatchRequestBody
		Reply: ERC1155MintBatchResponse
	}>(
		'/write/erc1155/:chainId/:contractAddress/mintBatch',
		{
			schema: ERC1155MintBatchSchema
		},
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId, contractAddress } = request.params

			try {
				const { recipients, ids, amounts, datas, waitForReceipt } = request.body

				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				const contract = new ethers.Contract(
					contractAddress,
					erc1155Abi,
					signer
				)

				const txs = recipients.map((account: string, index: number) => {
					const data = contract.interface.encodeFunctionData('mint', [
						account,
						ids[index],
						amounts[index],
						datas[index]
					])
					return {
						to: contractAddress,
						data
					}
				})

				const { simulationData, signedTx } =
					await prepareTransactionsForTenderlySimulation(
						signer,
						txs,
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

				logStep(request, 'Transactions prepared', { txs })

				const txService = new TransactionService(fastify)

			logStep(request, 'Sending mintBatch transaction...')
			const txResponse: TransactionResponse = await signer.sendTransaction(txs, {waitForReceipt: waitForReceipt ?? false})
			txHash = txResponse.hash
			logStep(request, 'MintBatch transaction sent', { txResponse })

			if (txResponse.receipt?.status === 0) {
				throw new Error('Transaction reverted', { cause: txResponse.receipt })
			}

				txs.forEach(async (tx, index) => {
					await txService.createTransaction({
						chainId,
						contractAddress,
						abi: erc1155Abi,
						data: tx.data,
						txHash: txHash ?? '',
						isDeployTx: false,
						args: [recipients[index], ids[index], amounts[index], datas[index]],
						functionName: 'mint'
					})
				})

			logStep(request, 'MintBatch transaction success', {
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
						: 'Failed to mint NFT'
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
