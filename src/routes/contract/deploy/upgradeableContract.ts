import type { ethers } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { encodeDeployData, encodeFunctionData, zeroAddress } from 'viem'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl, getContractAddressFromEvent } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type DeployUpgradeableContractRequestBody = {
	implementationAbi: Array<ethers.InterfaceAbi>
	implementationBytecode: string
	initializeFunctionName: string
	initializeArgs: Array<string>
}

type DeployUpgradeableContractRequestParams = {
	chainId: string
}

type DeployUpgradeableContractResponse = {
	result?: {
		deploymentTxHash?: string | null
		deploymentTxUrl?: string | null
		initializationTxHash: string | null
		initializationTxUrl: string | null
		deployedContractAddress: string | null
		txSimulationUrls?: string[]
		error?: string
	}
}

const DeployUpgradeableContractSchema = {
	tags: ['Contract', 'Deploy', 'Upgradeable'],
	description:
		"Deploy an upgradeable contract's implementation and call its initialize function.",
	params: {
		type: 'object',
		required: ['chainId'],
		properties: {
			chainId: { type: 'string' }
		}
	},
	body: {
		type: 'object',
		required: [
			'implementationAbi',
			'implementationBytecode',
			'initializeFunctionName',
			'initializeArgs'
		],
		properties: {
			implementationAbi: { type: 'array', items: { type: 'object' } },
			implementationBytecode: { type: 'string' },
			initializeFunctionName: { type: 'string' },
			initializeArgs: { type: 'array', items: { type: 'string' } }
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
						deploymentTxHash: { type: 'string', nullable: true },
						deploymentTxUrl: { type: 'string', nullable: true },
						initializationTxHash: { type: 'string' },
						initializationTxUrl: { type: 'string' },
						deployedContractAddress: { type: 'string' },
						txSimulationUrls: { type: 'array', items: { type: 'string' } },
						error: { type: 'string', nullable: true }
					}
				}
			}
		},
		400: {
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						error: { type: 'string' }
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
						error: { type: 'string' }
					}
				}
			}
		}
	}
}

export async function deployUpgradeableContract(fastify: FastifyInstance) {
	fastify.post<{
		Params: DeployUpgradeableContractRequestParams
		Body: DeployUpgradeableContractRequestBody
		Reply: DeployUpgradeableContractResponse
	}>(
		'/deploy/upgradeableContract/:chainId',
		{
			schema: DeployUpgradeableContractSchema
		},
		async (request, reply) => {
			const deploymentSimulationUrl: string | null = null
			const initializationSimulationUrl: string | null = null
			try {
				logRequest(request)
				const { chainId } = request.params
				const {
					implementationAbi,
					implementationBytecode,
					initializeFunctionName,
					initializeArgs
				} = request.body

				logStep(request, 'Validating implementation bytecode')
				if (!implementationBytecode.startsWith('0x')) {
					return reply.code(400).send({
						result: {
							deploymentTxHash: null,
							deploymentTxUrl: null,
							initializationTxHash: null,
							initializationTxUrl: null,
							deployedContractAddress: null,
							error: 'Implementation bytecode must start with 0x'
						}
					})
				}

				logStep(request, 'Getting tx signer')
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

				// Step 1: Deploy the implementation contract
				logStep(request, 'Preparing deploy data', {
					abi: implementationAbi,
					bytecode: implementationBytecode,
					args: []
				})
				const deployData = encodeDeployData({
					abi: implementationAbi,
					bytecode: implementationBytecode as `0x${string}`,
					args: []
				})
				logStep(request, 'Deploy data prepared')

				const deploymentTx = {
					to: zeroAddress,
					data: deployData
				}

				const {
					simulationData: deploymentSimulationData,
					signedTx: deploymentSignedTx
				} = await prepareTransactionsForTenderlySimulation(
					signer,
					[deploymentTx],
					Number(chainId)
				)
				const deploymentSimulationUrl = getTenderlySimulationUrl({
					chainId: chainId,
					gas: 3000000,
					block: await signer.provider.getBlockNumber(),
					contractAddress: deploymentSignedTx.entrypoint,
					blockIndex: 0,
					rawFunctionInput: deploymentSimulationData
				})

				logStep(request, 'Sending implementation deployment transaction')
				const deployTxResponse = await signer.sendTransaction(deploymentTx)
				logStep(request, 'Implementation deployment transaction sent')

				logStep(request, 'Waiting for implementation deployment receipt', {
					txHash: deployTxResponse.hash
				})
				const deployReceipt = await deployTxResponse.wait()
				logStep(request, 'Implementation deployment receipt received', {
					deployReceipt
				})

				if (deployReceipt?.status === 0) {
					logError(
						request,
						new Error(
							'Implementation contract deployment transaction reverted'
						),
						{ deployReceipt }
					)
					throw new Error(
						'Implementation contract deployment transaction reverted'
					)
				}

				const deployedContractAddress = getContractAddressFromEvent(
					deployReceipt,
					'CreatedContract(address)'
				)

				if (!deployedContractAddress) {
					logError(
						request,
						new Error(
							'Contract address not found after implementation deployment.'
						),
						{ deployReceipt }
					)
					throw new Error(
						'Contract address not found after implementation deployment. This can happen if the transaction failed or is not a contract creation.'
					)
				}
				logStep(request, 'Implementation contract deployed', {
					deployedContractAddress
				})

				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi: implementationAbi,
					data: deployData,
					txHash: deployReceipt?.hash ?? '',
					isDeployTx: true
				})

				// Step 2: Initialize the contract
				logStep(
					request,
					`Encoding initialize function data for '${initializeFunctionName}'`
				)
				const initializeData = encodeFunctionData({
					abi: implementationAbi,
					functionName: initializeFunctionName,
					args: initializeArgs
				})
				logStep(request, 'Initialize data prepared', { initializeData })

				const initializationTx = {
					to: deployedContractAddress,
					data: initializeData
				}

				const {
					simulationData: initializationSimulationData,
					signedTx: initializationSignedTx
				} = await prepareTransactionsForTenderlySimulation(
					signer,
					[initializationTx],
					Number(chainId)
				)
				const initializationSimulationUrl = getTenderlySimulationUrl({
					chainId: chainId,
					gas: 3000000,
					block: await signer.provider.getBlockNumber(),
					contractAddress: initializationSignedTx.entrypoint,
					blockIndex: 0,
					rawFunctionInput: initializationSimulationData
				})

				logStep(
					request,
					`Sending initialization transaction to ${deployedContractAddress} for function '${initializeFunctionName}'`
				)
				const initializeTxResponse =
					await signer.sendTransaction(initializationTx)
				logStep(request, 'Initialization transaction sent', {
					initializationTxHash: initializeTxResponse.hash
				})

				logStep(request, 'Waiting for initialization receipt')
				const initializeReceipt = await initializeTxResponse.wait()
				logStep(request, 'Initialization receipt received', {
					initializeReceipt
				})

				if (initializeReceipt?.status === 0) {
					logError(
						request,
						new Error(
							`Contract initialization transaction for function '${initializeFunctionName}' reverted`
						),
						{ initializeReceipt }
					)
					throw new Error(
						`Contract initialization transaction for function '${initializeFunctionName}' reverted`
					)
				}

				logStep(request, 'Creating transaction record in db')
				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi: implementationAbi,
					data: initializeData,
					txHash: initializeReceipt?.hash ?? '',
					functionName: initializeFunctionName,
					args: initializeArgs,
					isDeployTx: false
				})

				logStep(request, 'Deploy and initialize success')

				return reply.code(200).send({
					result: {
						deploymentTxHash: deployReceipt?.hash ?? null,
						deploymentTxUrl: getBlockExplorerUrl(
							Number(chainId),
							deployReceipt?.hash ?? ''
						),
						initializationTxHash: initializeReceipt?.hash ?? null,
						initializationTxUrl: getBlockExplorerUrl(
							Number(chainId),
							initializeReceipt?.hash ?? ''
						),
						deployedContractAddress: deployedContractAddress,
						txSimulationUrls: [
							deploymentSimulationUrl,
							initializationSimulationUrl
						]
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
						: 'Unknown error during upgradeable contract deployment'
				return reply.code(500).send({
					result: {
						deploymentTxHash: null,
						deploymentTxUrl: null,
						initializationTxHash: null,
						initializationTxUrl: null,
						deployedContractAddress: null,
						txSimulationUrls: [
							deploymentSimulationUrl ?? '',
							initializationSimulationUrl ?? ''
						],
						error: errorMessage
					}
				})
			}
		}
	)
}
