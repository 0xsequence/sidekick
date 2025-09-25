import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { erc1155ItemsAbi } from '~/constants/abis/erc1155Items'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import type { TransactionResponse } from '~/types/general'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import {
	extractTxHashFromErrorReceipt,
	getBlockExplorerUrl
} from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC1155ItemsBurnRequestBody = {
	tokenId: string
	amount: string
	waitForReceipt?: boolean
}

type ERC1155ItemsBurnRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC1155ItemsBurnResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC1155ItemsBurnSchema = {
	tags: ['ERC1155Items'],
	description: 'Burns a specific token on an ERC1155Items contract.',
	params: {
		type: 'object',
		required: ['chainId', 'contractAddress'],
		properties: {
			chainId: { type: 'string' },
			contractAddress: { type: 'string' }
		}
	},
	body: {
		type: 'object',
		required: ['tokenId', 'amount'],
		properties: {
			tokenId: { type: 'string', description: 'The ID of the token to burn.' },
			amount: { type: 'string' },
			waitForReceipt: { type: 'boolean', nullable: true }
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

export async function erc1155ItemsBurn(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC1155ItemsBurnRequestParams
		Body: ERC1155ItemsBurnRequestBody
		Reply: ERC1155ItemsBurnResponse
	}>(
		'/write/erc1155Items/:chainId/:contractAddress/burn',
		{
			schema: ERC1155ItemsBurnSchema
		},
		async (request, reply) => {
			logRequest(request)

			const tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId, contractAddress } = request.params

			try {
				const { tokenId, amount, waitForReceipt } = request.body

				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				const contract = new ethers.Contract(
					contractAddress,
					erc1155ItemsAbi,
					signer
				)

				const callData = contract.interface.encodeFunctionData('burn', [
					tokenId,
					amount
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

				logStep(request, 'Sending burn transaction...')
				const txResponse: TransactionResponse = await signer.sendTransaction(
					tx,
					{ waitForReceipt: waitForReceipt ?? false }
				)
				txHash = txResponse.hash
				logStep(request, 'Burn transaction sent', { txResponse })

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
					args: [tokenId, amount],
					functionName: 'burn'
				})

				logStep(request, 'Burn transaction success', {
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
					error instanceof Error ? error.message : 'Unknown error during burn'
				return reply.code(500).send({
					result: {
						txHash: finalTxHash,
						txUrl: finalTxHash
							? getBlockExplorerUrl(Number(chainId), finalTxHash)
							: null,
						txSimulationUrl: tenderlyUrl ?? null,
						error: errorMessage
					}
				})
			}
		}
	)
}
