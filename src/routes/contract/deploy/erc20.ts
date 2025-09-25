import type { FastifyInstance } from 'fastify'
import { encodeAbiParameters, encodeDeployData, zeroAddress } from 'viem'
import { erc20Abi } from '~/constants/abis/erc20'
import { erc20bytecode } from '~/constants/bytecodes/erc20'
import { erc20JsonInputMetadata } from '~/constants/contractJsonInputs/erc20'
import {
	type TenderlyTransaction,
	getTenderlySimulationUrl
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { prepareTransactionsForTenderlySimulation } from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import {
	isContractVerified,
	verifyContract
} from '~/utils/contractVerification'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import {
	extractTxHashFromErrorReceipt,
	getBlockExplorerUrl,
	getContractAddressFromEvent
} from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC20DeployRequestBody = {
	initialOwner: string
	name: string
	symbol: string
	waitForReceipt?: boolean
}

type ERC20DeployRequestParams = {
	chainId: string
}

type ERC20DeployResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		deployedContractAddress: string | null
		error?: string
	}
}

const ERC20DeploySchema = {
	tags: ['ERC20', 'Deploy'],
	description:
		'Deploy an ERC20 contract by providing the initial owner, name and symbol',
	body: {
		type: 'object',
		required: ['initialOwner', 'name', 'symbol'],
		properties: {
			initialOwner: { type: 'string' },
			name: { type: 'string' },
			symbol: { type: 'string' },
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
						txHash: { type: 'string' },
						txUrl: { type: 'string' },
						txSimulationUrl: { type: 'string', nullable: true },
						deployedContractAddress: { type: 'string' },
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
						error: { type: 'string' }
					}
				}
			}
		}
	}
}

export async function erc20Deploy(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC20DeployRequestParams
		Body: ERC20DeployRequestBody
		Reply: ERC20DeployResponse
	}>(
		'/deploy/erc20/:chainId',
		{
			schema: ERC20DeploySchema
		},
		async (request, reply) => {
			logRequest(request)

			const tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId } = request.params

			try {
				const { initialOwner, name, symbol, waitForReceipt } = request.body

				logStep(request, 'Getting tx signer', { chainId })
				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				logStep(request, 'Preparing deploy data', {
					abi: erc20Abi,
					bytecode: erc20bytecode,
					args: [initialOwner, name, symbol]
				})
				const data = encodeDeployData({
					abi: erc20Abi,
					bytecode: erc20bytecode as `0x${string}`,
					args: [initialOwner, name, symbol]
				})
				logStep(request, 'Deploy data prepared', { data })

				const deploymentTx: TenderlyTransaction = {
					data,
					to: zeroAddress
				}

				const { simulationData, signedTx } =
					await prepareTransactionsForTenderlySimulation(
						signer,
						[deploymentTx],
						Number(chainId)
					)
				const tenderlyUrl = getTenderlySimulationUrl({
					chainId: chainId,
					gas: 3000000,
					block: await signer.provider.getBlockNumber(),
					contractAddress: signedTx.entrypoint,
					blockIndex: 0,
					rawFunctionInput: simulationData
				})

				logStep(request, 'Sending deploy transaction', { data })
				const tx = await signer.sendTransaction(
					{
						data
					},
					{ waitForReceipt: true }
				)
				txHash = tx.hash
				logStep(request, 'Deploy transaction sent', { tx })

				if (tx.receipt?.status === 0) {
					logError(request, new Error('Transaction reverted'), {
						receipt: tx.receipt
					})
					throw new Error('Transaction reverted', { cause: tx.receipt })
				}

				const deployedContractAddress = getContractAddressFromEvent(
					tx.receipt,
					'CreatedContract(address)'
				)

				logStep(request, 'Creating transaction record in db', {
					chainId,
					contractAddress: deployedContractAddress,
					abi: erc20Abi,
					data,
					txHash: txHash,
					isDeployTx: true
				})
				const txService = new TransactionService(fastify)
				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi: erc20Abi,
					data,
					txHash: txHash,
					isDeployTx: true
				})

				logStep(request, 'Deploy transaction success', {
					txHash: txHash
				})

				logStep(request, 'Checking if contract is verified')
				const isVerified = await isContractVerified(
					deployedContractAddress,
					chainId
				)
				logStep(request, 'Contract verification result:', { isVerified })

				if (process.env.VERIFY_CONTRACT_ON_DEPLOY === 'true' && !isVerified) {
					logStep(request, 'Verifying contract', {
						chainId,
						contractAddress: deployedContractAddress,
						contractName: 'ERC20'
					})

					const encodedConstructorArguments = encodeAbiParameters(
						[
							{ name: 'initialOwner', type: 'address' },
							{ name: 'name', type: 'string' },
							{ name: 'symbol', type: 'string' }
						],
						[initialOwner as `0x${string}`, name, symbol]
					)

					// Remove "0x" prefix if present
					const encodedArgsNoPrefix = encodedConstructorArguments.startsWith(
						'0x'
					)
						? encodedConstructorArguments.slice(2)
						: encodedConstructorArguments

					const response = await verifyContract({
						chainId,
						contractAddress: deployedContractAddress,
						contractName: 'contracts/ERC20.sol:Token',
						compilerVersion: 'v0.8.27+commit.40a35a09',
						contractInputMetadata: erc20JsonInputMetadata,
						constructorArguments: encodedArgsNoPrefix
					})

					logStep(request, 'Contract verification response: ', { response })
				}

				return reply.code(200).send({
					result: {
						txHash: txHash,
						txUrl: getBlockExplorerUrl(Number(chainId), txHash),
						txSimulationUrl: tenderlyUrl,
						deployedContractAddress: deployedContractAddress
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
					error instanceof Error ? error.message : 'Failed to deploy ERC20'
				return reply.code(500).send({
					result: {
						txHash: finalTxHash,
						txUrl: finalTxHash
							? getBlockExplorerUrl(Number(chainId), finalTxHash)
							: null,
						txSimulationUrl: tenderlyUrl,
						deployedContractAddress: null,
						error: errorMessage
					}
				})
			}
		}
	)
}
