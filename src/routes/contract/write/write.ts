import type { InterfaceAbi, TransactionResponse } from 'ethers'
import type { FastifyInstance } from 'fastify'

import { ethers } from 'ethers'
import { PRISMA_NOT_INITIALIZED } from '~/constants/errors'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { AbiSchema } from '~/schemas/contractSchemas'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type WriteRequestBody = {
	abi?: InterfaceAbi
	args?: Array<string>
}

type WriteRequestParams = {
	chainId: string
	contractAddress: string
	functionName: string
}

export type WriteContractResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const WriteContractSchema = {
	description: 'Write to a smart contract',
	tags: ['Contract'],
	body: {
		type: 'object',
		properties: {
			args: {
				type: 'array',
				items: {
					type: 'string'
				},
				description: 'JSON stringified array of function arguments'
			},
			abi: {
				type: 'array',
				items: AbiSchema,
				description:
					'Contract ABI in JSON format. If not provided, the ABI will be fetched from the sidekick database, make sure the contract is added to the database first or pass the abi manually.'
			}
		}
	},
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string', nullable: true }
		}
	},
	params: {
		type: 'object',
		required: ['chainId', 'contractAddress', 'functionName'],
		properties: {
			chainId: {
				type: 'string',
				description: 'Chain ID of the network'
			},
			contractAddress: {
				type: 'string',
				description: 'Contract address'
			},
			functionName: {
				type: 'string',
				description: 'Function name to call'
			}
		}
	},
	response: {
		200: {
			description: 'Successful response',
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						txHash: { type: 'string', nullable: true },
						txUrl: { type: 'string', nullable: true },
						txSimulationUrl: { type: 'string', nullable: true },
						error: { type: 'string', nullable: true }
					}
				}
			}
		}
	}
}

export async function writeContract(fastify: FastifyInstance) {
	fastify.post<{
		Params: WriteRequestParams
		Body: WriteRequestBody
		Reply: WriteContractResponse
	}>(
		'/write/contract/:chainId/:contractAddress/:functionName',
		{
			schema: WriteContractSchema
		},
		async (request, reply) => {
			logRequest(request)
			const tenderlyUrl: string | null = null
			try {
				const { args, abi: abiFromBody } = request.body
				const { chainId, contractAddress, functionName } = request.params

				// Get the signer to use for the transaction
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

				let abiFromDb: ethers.InterfaceAbi | undefined
				if (!abiFromBody) {
					logStep(request, 'ABI not provided, fetching from db')
					if (!fastify.prisma) throw new Error(PRISMA_NOT_INITIALIZED)

					const contract = await fastify.prisma.contract.findUnique({
						where: {
							contractAddress,
							chainId: Number(chainId)
						}
					})

					if (contract) {
						if (!contract.abi) {
							logError(request, new Error('Contract ABI not found in db.'))
							return reply.code(400).send({
								result: {
									txHash: null,
									txUrl: null,
									error:
										'Contract ABI not found in db. Make sure the contract is added to the database first or pass the abi manually.'
								}
							})
						}
						abiFromDb = JSON.parse(contract.abi)
						logStep(request, 'ABI loaded from db')
					} else {
						logError(request, new Error('Contract not found in db.'), {
							contractAddress,
							chainId
						})
						return reply.code(400).send({
							result: {
								txHash: null,
								txUrl: null,
								error: 'Contract not found in db.'
							}
						})
					}
				} else {
					logStep(request, 'ABI loaded from request body')
				}

				// Create contract instance with full ABI
				const contract = new ethers.Contract(
					contractAddress,
					abiFromBody ?? abiFromDb ?? [],
					signer
				)
				logStep(request, 'Contract instance created')

				// Encode function data dynamically
				const data = contract.interface.encodeFunctionData(
					functionName,
					args ?? []
				)
				logStep(request, 'Function data encoded', { functionName, args })

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
				const tenderlyUrl = getTenderlySimulationUrl({
					chainId: chainId,
					gas: 3000000,
					block: await signer.provider.getBlockNumber(),
					blockIndex: 0,
					contractAddress: signedTx.entrypoint,
					rawFunctionInput: simulationData
				})

				const txService = new TransactionService(fastify)

				logStep(request, 'Sending contract transaction...')
				const txResponse: TransactionResponse = await signer.sendTransaction(tx)
				logStep(request, 'Contract transaction sent', {
					txHash: txResponse.hash
				})

				const receipt = await txResponse.wait()

				if (receipt?.status === 0) {
					throw new Error('Transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					// @ts-ignore
					abi: abiFromBody ?? abiFromDb,
					data: tx.data,
					txHash: receipt?.hash ?? '',
					isDeployTx: false,
					args: args ?? [],
					functionName: functionName
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
								: 'Failed to execute contract transaction'
					}
				})
			}
		}
	)
}
