import type { TransactionReceipt } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { encodeDeployData, encodeFunctionData, numberToHex, pad, zeroAddress } from 'viem'
import { erc1155ItemsAbi } from '~/constants/abis/erc1155Items'
import { erc1155ItemsBytecode } from '~/constants/bytecodes/erc1155Items'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl, getContractAddressFromEvent } from '~/utils/other'
import { getSigner } from '~/utils/wallet'
import type { TransactionResponse } from '~/types/general'

type ERC1155ItemsDeployRequestBody = {
	owner: string
	tokenName: string
	tokenBaseURI: string
	tokenContractURI: string
	royaltyReceiver: string
	royaltyFeeNumerator: string
	implicitModeValidator: string | undefined | null
	implicitModeProjectId: string | undefined | null
	waitForReceipt?: boolean
}

type ERC1155ItemsDeployRequestParams = {
	chainId: string
}

type ERC1155ItemsDeployResponse = {
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

const ERC1155ItemsDeploySchema = {
	tags: ['ERC1155Items', 'Deploy'],
	description:
		'Deploy an Upgradable ERC1155Items contract and call its initialize function.',
	body: {
		type: 'object',
		required: [
			'owner',
			'tokenName',
			'tokenBaseURI',
			'tokenContractURI',
			'royaltyReceiver',
			'royaltyFeeNumerator'
		],
		properties: {
			owner: { type: 'string', description: 'Address of the contract owner' },
			tokenName: { type: 'string', description: 'Name of the token' },
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
			},
			waitForReceipt: { type: 'boolean', nullable: true }
		}
	},
	params: {
		type: 'object',
		required: ['chainId'],
		properties: {
			chainId: { type: 'string' }
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
		}
	}
}

export async function erc1155ItemsDeploy(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC1155ItemsDeployRequestParams
		Body: ERC1155ItemsDeployRequestBody
		Reply: ERC1155ItemsDeployResponse
	}>(
		'/deploy/erc1155Items/:chainId',
		{
			schema: ERC1155ItemsDeploySchema
		},
		async (request, reply) => {
			logRequest(request)

			let deploymentSimulationUrl: string | null = null
			let initializationSimulationUrl: string | null = null
			let deploymentTxHash: string | null = null
			let initializationTxHash: string | null = null
			const { chainId } = request.params

			try {
			const {
				owner,
				tokenName,
				tokenBaseURI,
				tokenContractURI,
				royaltyReceiver,
				royaltyFeeNumerator,
				implicitModeValidator,
				implicitModeProjectId,
				waitForReceipt
			} = request.body

				logStep(request, 'Getting tx signer', { chainId })
				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})
				const txService = new TransactionService(fastify)

				// Step 1: Deploy the contract
				logStep(request, 'Preparing deploy data', {
					abi: erc1155ItemsAbi,
					bytecode: erc1155ItemsBytecode,
					args: []
				})
				const deployData = encodeDeployData({
					abi: erc1155ItemsAbi,
					bytecode: erc1155ItemsBytecode as `0x${string}`,
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

			logStep(request, 'Sending deployment transaction')
			const deployTx: TransactionResponse = await signer.sendTransaction({
				data: deployData
			}, {waitForReceipt: true})
			deploymentTxHash = deployTx.hash
			logStep(request, 'Deployment transaction sent', { deployTx })

			if (deployTx.receipt?.status === 0) {
				logError(
					request,
					new Error('Contract deployment transaction reverted'),
					{ deployReceipt: deployTx.receipt }
				)
				throw new Error('Transaction reverted', { cause: deployTx.receipt })
			}

			const deployedContractAddress = getContractAddressFromEvent(
				deployTx.receipt,
				'CreatedContract(address)'
			)

				if (!deployedContractAddress) {
					logError(
						request,
						new Error('Contract address not found after deployment'),
						{ deployTx }
					)
					throw new Error('Contract address not found after deployment')
				}
				logStep(request, 'Contract deployed', { deployedContractAddress })

				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi: erc1155ItemsAbi,
					data: deployData,
					txHash: deploymentTxHash,
					isDeployTx: true
				})

				// Step 2: Initialize the contract
				logStep(request, 'Preparing initialize data', {
					functionName: 'initialize',
					args: [
						owner,
						tokenName,
						tokenBaseURI,
						tokenContractURI,
						royaltyReceiver,
						royaltyFeeNumerator
					]
				})
				const initializeData = encodeFunctionData({
					abi: erc1155ItemsAbi,
					functionName: 'initialize',
					args: [
						owner,
						tokenName,
						tokenBaseURI,
						tokenContractURI,
						royaltyReceiver,
						BigInt(royaltyFeeNumerator),
						implicitModeValidator ?? zeroAddress,
						pad(numberToHex(Number(implicitModeProjectId ?? 0)), { size: 32 })
					]
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

			logStep(request, 'Sending initialization transaction')
			const initializeTx = await signer.sendTransaction(initializationTx, {waitForReceipt: true})
			initializationTxHash = initializeTx.hash
			logStep(request, 'Initialization transaction sent')

			if (initializeTx.receipt?.status === 0) {
				logError(
					request,
					new Error('Contract initialization transaction reverted'),
					{ initializeReceipt: initializeTx.receipt }
				)
				throw new Error('Transaction reverted', { cause: initializeTx.receipt })
			}

				logStep(request, 'Creating transaction record in db')
				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi: erc1155ItemsAbi,
					data: initializeData,
					txHash: initializationTxHash,
					isDeployTx: false
				})

				logStep(request, 'Deploy and initialize success')

			return reply.code(200).send({
				result: {
					deploymentTxHash: deploymentTxHash,
					deploymentTxUrl: getBlockExplorerUrl(
						Number(chainId),
						deploymentTxHash
					),
					initializationTxHash: initializationTxHash,
					initializationTxUrl: getBlockExplorerUrl(
						Number(chainId),
						initializationTxHash
					),
					deployedContractAddress: deployedContractAddress,
					txSimulationUrls: [
						deploymentSimulationUrl,
						initializationSimulationUrl
					]
				}
			})
			} catch (error) {
				// Extract transaction hash from error receipt if available
				const errorTxHash = extractTxHashFromErrorReceipt(error)
				const finalDeploymentTxHash = deploymentTxHash ?? errorTxHash
				const finalInitializationTxHash = initializationTxHash ?? errorTxHash

				logError(request, error, {
					params: request.params,
					body: request.body,
					deploymentTxHash: finalDeploymentTxHash,
					initializationTxHash: finalInitializationTxHash
				})

				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to deploy and initialize ERC1155Items contract'
				return reply.code(500).send({
					result: {
						deploymentTxHash: finalDeploymentTxHash,
						deploymentTxUrl: finalDeploymentTxHash ? getBlockExplorerUrl(Number(chainId), finalDeploymentTxHash) : null,
						initializationTxHash: finalInitializationTxHash,
						initializationTxUrl: finalInitializationTxHash ? getBlockExplorerUrl(Number(chainId), finalInitializationTxHash) : null,
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
