import type { TransactionResponse } from 'ethers'
import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { erc1155Abi } from '~/constants/abis/erc1155'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC1155MintBatchRequestBody = {
	recipients: string[]
	ids: string[]
	amounts: string[]
	datas: string[]
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
			datas: { type: 'array', items: { type: 'string' } }
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
			let tenderlyUrl: string | null = null
			try {
				logRequest(request)

				const { recipients, ids, amounts, datas } = request.body
				const { chainId, contractAddress } = request.params

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

				logStep(request, 'Sending transactions...')
				const txResponse: TransactionResponse =
					await signer.sendTransaction(txs)
				logStep(request, 'Transactions sent', { txResponse })

				const receipt = await txResponse.wait()
				if (receipt?.status === 0) {
					throw new Error('Transaction reverted')
				}

				txs.forEach(async (tx, index) => {
					await txService.createTransaction({
						chainId,
						contractAddress,
						abi: erc1155Abi,
						data: tx.data,
						txHash: receipt?.hash ?? '',
						isDeployTx: false,
						args: [recipients[index], ids[index], amounts[index], datas[index]],
						functionName: 'mint'
					})
				})

				logStep(request, 'Mint batch transaction success', {
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
						error: error instanceof Error ? error.message : 'Failed to mint NFT'
					}
				})
			}
		}
	)
}
