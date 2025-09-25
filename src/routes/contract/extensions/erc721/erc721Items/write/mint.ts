import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
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

type ERC721ItemsMintRequestBody = {
	to: string
	tokenId: string
	waitForReceipt?: boolean
}

type ERC721ItemsMintRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC721ItemsMintResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC721ItemsMintSchema = {
	tags: ['ERC721Items'],
	body: {
		type: 'object',
		required: ['to', 'tokenId'],
		properties: {
			to: { type: 'string' },
			tokenId: { type: 'string' },
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

export async function erc721ItemsMint(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC721ItemsMintRequestParams
		Body: ERC721ItemsMintRequestBody
		Reply: ERC721ItemsMintResponse
	}>(
		'/write/erc721Items/:chainId/:contractAddress/mint',
		{ schema: ERC721ItemsMintSchema },
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null

			const { to, tokenId, waitForReceipt } = request.body
			const { chainId, contractAddress } = request.params

			try {
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

				const contract = new ethers.Contract(
					contractAddress,
					erc721ItemsAbi,
					signer
				)
				logStep(request, 'Contract instance created')

				const data = contract.interface.encodeFunctionData('mint', [
					to,
					tokenId
				])
				logStep(request, 'Function data encoded', { to, tokenId })

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

				logStep(request, 'Sending mint transaction...')
				const txResponse: TransactionResponse = await signer.sendTransaction(
					tx,
					{ waitForReceipt: waitForReceipt ?? false }
				)
				txHash = txResponse.hash
				logStep(request, 'Mint transaction sent', { txResponse })

				if (txResponse.receipt?.status === 0) {
					throw new Error('Transaction reverted', { cause: txResponse.receipt })
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc721ItemsAbi,
					data: tx.data,
					txHash: txHash,
					isDeployTx: false,
					args: [to, tokenId],
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

				return reply.code(500).send({
					result: {
						txHash: finalTxHash,
						txUrl: finalTxHash
							? getBlockExplorerUrl(Number(chainId), finalTxHash)
							: null,
						txSimulationUrl: tenderlyUrl ?? null,
						error:
							error instanceof Error
								? error.message
								: 'Failed to mint ERC721Items'
					}
				})
			}
		}
	)
}
