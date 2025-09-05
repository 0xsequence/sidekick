import type { TransactionResponse } from 'ethers'
import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { erc721ItemsAbi } from '~/constants/abis/erc721Items'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC721ItemsMintRequestBody = {
	to: string
	tokenId: string
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
			tokenId: { type: 'string' }
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

			try {
				const { to, tokenId } = request.body
				const { chainId, contractAddress } = request.params

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

				console.log('tenderlyUrl', tenderlyUrl)

				const txService = new TransactionService(fastify)

				logStep(request, 'Sending mint transaction...')
				const txResponse: TransactionResponse = await signer.sendTransaction(tx)
				logStep(request, 'Mint transaction sent', { txResponse })

				const receipt = await txResponse.wait()
				if (receipt?.status === 0) {
					throw new Error('Transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc721ItemsAbi,
					data: tx.data,
					txHash: receipt?.hash ?? '',
					isDeployTx: false,
					args: [to, tokenId],
					functionName: 'mint'
				})

				logStep(request, 'Mint transaction success', {
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
				logError(request, error, {
					params: request.params,
					body: request.body
				})
				return reply.code(500).send({
					result: {
						txHash: null,
						txUrl: null,
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
