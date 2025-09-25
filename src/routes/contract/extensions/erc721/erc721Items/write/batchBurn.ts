import type { FastifyInstance } from 'fastify'
import { encodeFunctionData } from 'viem'
import { erc721ItemsAbi } from '~/constants/abis/erc721Items'
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

type ERC721ItemsBatchBurnRequestBody = {
	tokenIds: string[]
	waitForReceipt?: boolean
}

type ERC721ItemsBatchBurnRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC721ItemsBatchBurnResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC721ItemsBatchBurnSchema = {
	tags: ['ERC721Items'],
	description:
		'Burns multiple tokens on an ERC721Items contract in a single transaction.',
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
		required: ['tokenIds'],
		properties: {
			tokenIds: {
				type: 'array',
				items: { type: 'string' },
				description: 'An array of token IDs to burn.'
			},
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
						txSimulationUrl: { type: 'string', nullable: true },
						error: { type: 'string', nullable: true }
					}
				}
			}
		}
	}
}

export async function erc721ItemsBatchBurn(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC721ItemsBatchBurnRequestParams
		Body: ERC721ItemsBatchBurnRequestBody
		Reply: ERC721ItemsBatchBurnResponse
	}>(
		'/write/erc721Items/:chainId/:contractAddress/batchBurn',
		{
			schema: ERC721ItemsBatchBurnSchema
		},
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId, contractAddress } = request.params

			try {
				const { tokenIds, waitForReceipt } = request.body

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
				const txService = new TransactionService(fastify)

				const batchBurnData = encodeFunctionData({
					abi: erc721ItemsAbi,
					functionName: 'batchBurn',
					args: [tokenIds.map((id) => BigInt(id))]
				})
				logStep(request, 'Function data encoded', { tokenIds })

				const tx = {
					to: contractAddress,
					data: batchBurnData
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

				logStep(request, 'Sending batchBurn transaction...')
				const txResponse: TransactionResponse = await signer.sendTransaction(
					{
						to: contractAddress,
						data: batchBurnData
					},
					{ waitForReceipt: waitForReceipt ?? false }
				)
				txHash = txResponse.hash
				logStep(request, 'BatchBurn transaction sent', { txResponse })

				if (txResponse.receipt?.status === 0) {
					throw new Error('Transaction reverted', { cause: txResponse.receipt })
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc721ItemsAbi,
					data: batchBurnData,
					txHash: txHash,
					functionName: 'batchBurn',
					args: tokenIds,
					isDeployTx: false
				})
				logStep(request, 'Transaction record created in db')

				logStep(request, 'BatchBurn transaction success', {
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
						: 'Unknown error during batchBurn'
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
