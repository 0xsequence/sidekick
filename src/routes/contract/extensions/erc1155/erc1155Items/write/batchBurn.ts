import type { TransactionResponse } from 'ethers'
import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { erc1155ItemsAbi } from '~/constants/abis/erc1155Items'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC1155ItemsBatchBurnRequestBody = {
	tokenIds: string[]
	amounts: string[]
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
			amounts: { type: 'array', items: { type: 'string' } }
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
			const tenderlyUrl: string | null = null
			try {
				logRequest(request)

				const { tokenIds, amounts } = request.body
				const { chainId, contractAddress } = request.params

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
				const txResponse: TransactionResponse = await signer.sendTransaction(tx)
				logStep(request, 'BatchBurn transaction sent', { txResponse })

				const receipt = await txResponse.wait()

				if (receipt?.status === 0) {
					throw new Error('Transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc1155ItemsAbi,
					data: tx.data,
					txHash: receipt?.hash ?? '',
					isDeployTx: false,
					args: [JSON.stringify(tokenIds), JSON.stringify(amounts)],
					functionName: 'batchBurn'
				})

				logStep(request, 'Batch burn transaction success', {
					txHash: txResponse.hash
				})
				return reply.code(200).send({
					result: {
						txHash: txResponse.hash,
						txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash),
						txSimulationUrl: tenderlyUrl ?? null
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						txHash: null,
						txUrl: null,
						txSimulationUrl: tenderlyUrl ?? null,
						error:
							error instanceof Error
								? error.message
								: 'Failed to batchBurn ERC1155Items'
					}
				})
			}
		}
	)
}
