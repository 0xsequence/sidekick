import type { FastifyInstance } from 'fastify'
import { encodeAbiParameters, encodeDeployData, zeroAddress } from 'viem'
import { erc1155Abi } from '~/constants/abis/erc1155'
import { erc1155bytecode } from '~/constants/bytecodes/erc1155'
import { erc1155JsonInputMetadata } from '~/constants/contractJsonInputs/erc1155'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { verifyContract } from '~/utils/contractVerification'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import {
	extractTxHashFromErrorReceipt,
	getBlockExplorerUrl,
	getContractAddressFromEvent
} from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC1155DeployRequestBody = {
	defaultAdmin: string
	minter: string
	name: string
	waitForReceipt?: boolean
}

type ERC1155DeployRequestParams = {
	chainId: string
}

type ERC1155DeployResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		deployedContractAddress: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC1155DeploySchema = {
	tags: ['Deploy'],
	description:
		'Deploy an ERC1155 contract by providing the default admin, minter and name',
	body: {
		type: 'object',
		required: ['defaultAdmin', 'minter', 'name'],
		properties: {
			defaultAdmin: { type: 'string' },
			minter: { type: 'string' },
			name: { type: 'string' },
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
						deployedContractAddress: { type: 'string' },
						txSimulationUrl: { type: 'string', nullable: true },
						error: { type: 'string', nullable: true }
					}
				}
			}
		}
	}
}

export async function erc1155Deploy(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC1155DeployRequestParams
		Body: ERC1155DeployRequestBody
		Reply: ERC1155DeployResponse
	}>(
		'/deploy/erc1155/:chainId',
		{
			schema: ERC1155DeploySchema
		},
		async (request, reply) => {
			logRequest(request)

			const tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId } = request.params

			try {
				const { defaultAdmin, minter, name, waitForReceipt } = request.body

				logStep(request, 'Getting tx signer', { chainId })
				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				logStep(request, 'Preparing deploy data', {
					abi: erc1155Abi,
					bytecode: erc1155bytecode,
					args: [defaultAdmin, minter, name]
				})
				const data = encodeDeployData({
					abi: erc1155Abi,
					bytecode: erc1155bytecode as `0x${string}`,
					args: [defaultAdmin, minter, name]
				})
				logStep(request, 'Deploy data prepared')

				const deploymentTx = {
					to: zeroAddress,
					data
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

				logStep(request, 'Sending deploy transaction')
				const tx = await signer.sendTransaction(deploymentTx, {
					waitForReceipt: true
				})
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

				logStep(request, 'Creating transaction record in db')
				const txService = new TransactionService(fastify)
				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi: erc1155Abi,
					data,
					txHash: txHash,
					isDeployTx: true
				})

				logStep(request, 'Deploy transaction success', {
					txHash: txHash
				})

				// --- Verification logic (added) ---
				if (process.env.VERIFY_CONTRACT_ON_DEPLOY === 'true') {
					logStep(request, 'Verifying contract', {
						chainId,
						contractAddress: deployedContractAddress,
						contractName: 'ERC721'
					})

					const encodedConstructorArguments = encodeAbiParameters(
						[
							{ name: 'defaultAdmin', type: 'address' },
							{ name: 'minter', type: 'address' },
							{ name: 'name', type: 'string' }
						],
						[defaultAdmin as `0x${string}`, minter as `0x${string}`, name]
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
						contractName: 'contracts/ERC721.sol:NFT',
						compilerVersion: 'v0.8.27+commit.40a35a09',
						contractInputMetadata: erc1155JsonInputMetadata,
						constructorArguments: encodedArgsNoPrefix
					})

					logStep(request, 'Contract verification response: ', { response })
				}
				// --- End verification logic ---

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
					error instanceof Error ? error.message : 'Failed to deploy ERC1155'
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
