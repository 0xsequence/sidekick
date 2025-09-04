import type { FastifyInstance } from 'fastify'
import { encodeFunctionData, numberToHex, pad, zeroAddress } from 'viem'

import { erc721ItemsAbi } from '~/constants/abis/erc721Items'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC721ItemsInitializeRequestBody = {
	owner: string
	tokenName: string
	tokenSymbol: string
	tokenBaseURI: string
	tokenContractURI: string
	royaltyReceiver: string
	royaltyFeeNumerator: string
	implicitModeValidator: string | undefined | null
	implicitModeProjectId: string | undefined | null
}

type ERC721ItemsInitializeRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC721ItemsInitializeResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC721ItemsInitializeSchema = {
	tags: ['ERC721Items'],
	description: 'Calls the initialize function on an ERC721Items contract.',
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
		required: [
			'owner',
			'tokenName',
			'tokenSymbol',
			'tokenBaseURI',
			'tokenContractURI',
			'royaltyReceiver',
			'royaltyFeeNumerator',
			'implicitModeValidator',
			'implicitModeProjectId'
		],
		properties: {
			owner: { type: 'string', description: 'Address of the contract owner' },
			tokenName: { type: 'string', description: 'Name of the token' },
			tokenSymbol: { type: 'string', description: 'Symbol of the token' },
			tokenBaseURI: {
				type: 'string',
				description: 'Base URI for token metadata'
			},
			tokenContractURI: {
				type: 'string',
				description: 'Contract URI for collection metadata'
			},
			royaltyReceiver: {
				type: 'string',
				description: 'Address to receive royalties'
			},
			royaltyFeeNumerator: {
				type: 'string',
				description: 'Royalty fee numerator (e.g., 500 for 5%)'
			},
			implicitModeValidator: {
				type: 'string',
				description: 'Address of the implicit mode validator',
				nullable: true
			},
			implicitModeProjectId: {
				type: 'string',
				description: 'Implicit mode project ID',
				nullable: true
			}
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
		400: {
			type: 'object',
			properties: {
				error: { type: 'string' }
			}
		},
		500: {
			type: 'object',
			properties: {
				error: { type: 'string' }
			}
		}
	}
}

export async function erc721ItemsInitialize(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC721ItemsInitializeRequestParams
		Body: ERC721ItemsInitializeRequestBody
		Reply: ERC721ItemsInitializeResponse
	}>(
		'/write/erc721Items/:chainId/:contractAddress/initialize',
		{
			schema: ERC721ItemsInitializeSchema
		},
		async (request, reply) => {
			logRequest(request)

			const tenderlyUrl: string | null = null

			try {
				const { chainId, contractAddress } = request.params
				const {
					owner,
					tokenName,
					tokenSymbol,
					tokenBaseURI,
					tokenContractURI,
					royaltyReceiver,
					royaltyFeeNumerator,
					implicitModeValidator,
					implicitModeProjectId
				} = request.body

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

				const initializeData = encodeFunctionData({
					abi: erc721ItemsAbi,
					functionName: 'initialize',
					args: [
						owner,
						tokenName,
						tokenSymbol,
						tokenBaseURI,
						tokenContractURI,
						royaltyReceiver,
						BigInt(royaltyFeeNumerator ?? 0),
						implicitModeValidator ?? zeroAddress,
						pad(numberToHex(Number(implicitModeProjectId ?? 0)), { size: 32 })
					]
				})
				logStep(request, 'Function data encoded', {
					owner,
					tokenName,
					tokenSymbol
				})

				const tx = {
					to: contractAddress,
					data: initializeData
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

				logStep(request, 'Sending initialize transaction...')
				const txResponse = await signer.sendTransaction({
					to: contractAddress,
					data: initializeData
				})
				logStep(request, 'Initialize transaction sent', { txResponse })

				const receipt = await txResponse.wait()
				logStep(request, 'Initialize transaction mined', { receipt })

				if (receipt?.status === 0) {
					logError(request, new Error('Initialize transaction reverted'), {
						receipt
					})
					throw new Error('Initialize transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc721ItemsAbi,
					data: initializeData,
					txHash: receipt?.hash ?? '',
					functionName: 'initialize',
					args: [
						owner,
						tokenName,
						tokenSymbol,
						tokenBaseURI,
						tokenContractURI,
						royaltyReceiver,
						royaltyFeeNumerator,
						implicitModeValidator ?? zeroAddress,
						pad(numberToHex(Number(implicitModeProjectId ?? 0)), { size: 32 })
					],
					isDeployTx: false
				})
				logStep(request, 'Transaction record created in db')

				logStep(request, 'Initialize transaction success', {
					txHash: receipt?.hash
				})
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
						: 'Unknown error during initialization'
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
