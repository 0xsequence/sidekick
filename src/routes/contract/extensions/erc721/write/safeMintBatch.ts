import type { TransactionResponse } from 'ethers'
import { ethers } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { erc721Abi } from '~/constants/abis/erc721'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC721SafeMintBatchRequestBody = {
	recipients: string[]
	tokenIds: string[]
}

type ERC721SafeMintBatchRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC721SafeMintBatchResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC721SafeMintBatchSchema = {
	tags: ['ERC721'],
	body: {
		type: 'object',
		required: ['recipients', 'tokenIds'],
		properties: {
			recipients: { type: 'array', items: { type: 'string' } },
			tokenIds: { type: 'array', items: { type: 'string' } }
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

export async function erc721SafeMintBatch(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC721SafeMintBatchRequestParams
		Body: ERC721SafeMintBatchRequestBody
		Reply: ERC721SafeMintBatchResponse
	}>(
		'/write/erc721/:chainId/:contractAddress/safeMintBatch',
		{
			schema: ERC721SafeMintBatchSchema
		},
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId, contractAddress } = request.params

			try {
				const { recipients, tokenIds } = request.body

				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				const contract = new ethers.Contract(contractAddress, erc721Abi, signer)
				logStep(request, 'Contract instance created')

				const txs = recipients.map((recipient, index) => {
					const data = contract.interface.encodeFunctionData('safeMint', [
						recipient,
						tokenIds[index]
					])
					return {
						to: contractAddress,
						data
					}
				})
				logStep(request, 'Function data encoded for batch', {
					count: txs.length
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

				const txService = new TransactionService(fastify)

				logStep(request, 'Sending batch transaction...')
				const txResponse: TransactionResponse =
					await signer.sendTransaction(txs)
				txHash = txResponse.hash
				logStep(request, 'Batch transaction sent', { txResponse })

				const receipt = await txResponse.wait()

				if (receipt?.status === 0) {
					throw new Error('Transaction reverted')
				}

				txs.forEach(async (tx, index) => {
					await txService.createTransaction({
						chainId,
						contractAddress,
						abi: erc721Abi,
						data: tx.data,
						txHash: receipt?.hash ?? '',
						isDeployTx: false,
						args: [recipients[index], tokenIds[index]],
						functionName: 'safeMint'
					})
				})

				logStep(request, 'Batch transaction success', { txResponse })
				return reply.code(200).send({
					result: {
						txHash: txResponse.hash,
						txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash),
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
