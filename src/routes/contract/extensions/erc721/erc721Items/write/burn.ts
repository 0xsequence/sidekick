import type { FastifyInstance } from 'fastify'
import { type Abi, encodeFunctionData } from 'viem'
import { getSigner } from '~/utils/wallet'

import { erc721ItemsAbi } from '~/constants/abis/erc721Items'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl } from '~/utils/other'

type ERC721ItemsBurnRequestBody = {
	tokenId: string
}

type ERC721ItemsBurnRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC721ItemsBurnResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC721ItemsBurnSchema = {
	tags: ['ERC721Items'],
	description: 'Burns a specific token on an ERC721Items contract.',
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
		required: ['tokenId'],
		properties: {
			tokenId: { type: 'string', description: 'The ID of the token to burn.' }
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

export async function erc721ItemsBurn(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC721ItemsBurnRequestParams
		Body: ERC721ItemsBurnRequestBody
		Reply: ERC721ItemsBurnResponse
	}>(
		'/write/erc721Items/:chainId/:contractAddress/burn',
		{
			schema: ERC721ItemsBurnSchema
		},
		async (request, reply) => {
			logRequest(request)

			const tenderlyUrl: string | null = null

			try {
				const { chainId, contractAddress } = request.params
				const { tokenId } = request.body

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

				const burnData = encodeFunctionData({
					abi: erc721ItemsAbi,
					functionName: 'burn',
					args: [BigInt(tokenId)]
				})
				logStep(request, 'Function data encoded', { tokenId })

				const tx = {
					to: contractAddress,
					data: burnData
				}

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

				logStep(request, 'Sending burn transaction...')
				const txResponse = await signer.sendTransaction({
					to: contractAddress,
					data: burnData
				})
				logStep(request, 'Burn transaction sent', { txResponse })

				const receipt = await txResponse.wait()
				logStep(request, 'Burn transaction mined', { receipt })

				if (receipt?.status === 0) {
					logError(request, new Error('Burn transaction reverted'), { receipt })
					throw new Error('Burn transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc721ItemsAbi,
					data: burnData,
					txHash: receipt?.hash ?? '',
					functionName: 'burn',
					args: [tokenId],
					isDeployTx: false
				})
				logStep(request, 'Transaction record created in db')

				logStep(request, 'Burn transaction success', { txHash: receipt?.hash })
				return reply.code(200).send({
					result: {
						txHash: receipt?.hash ?? null,
						txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
						txSimulationUrl: tenderlyUrl ?? null
					}
				})
			} catch (error) {
				logError(request, error, {
					params: request.params,
					body: request.body
				})
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Unknown error during burn, please check that you own the NFT you are trying to burn'
				return reply.code(500).send({
					result: {
						txHash: null,
						txUrl: null,
						txSimulationUrl: tenderlyUrl ?? null,
						error: errorMessage
					}
				})
			}
		}
	)
}
