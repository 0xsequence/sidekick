import type { ethers } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { encodeDeployData, zeroAddress } from 'viem'
import {
	type TenderlyTransaction,
	getTenderlySimulationUrl
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { prepareTransactionsForTenderlySimulation } from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl, getContractAddressFromEvent } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type DeployContractRequestBody = {
	abi: Array<ethers.InterfaceAbi>
	bytecode: string
	args: Array<string>
}

type DeployContractRequestParams = {
	chainId: string
}

type DeployContractResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		deployedContractAddress: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const DeployContractSchema = {
	tags: ['Contract', 'Deploy'],
	description:
		'Deploy any contract by providing the abi, bytecode and constructor arguments',
	body: {
		type: 'object',
		required: ['args', 'abi', 'bytecode'],
		properties: {
			args: { type: 'array', items: { type: 'string' } },
			abi: { type: 'array', items: { type: 'object' } },
			bytecode: {
				type: 'string',
				description:
					'String representation of the bytecode without the 0x prefix'
			}
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
						error: { type: 'string', nullable: true }
					}
				}
			}
		}
	}
}

export async function deployContract(fastify: FastifyInstance) {
	fastify.post<{
		Params: DeployContractRequestParams
		Body: DeployContractRequestBody
		Reply: DeployContractResponse
	}>(
		'/deploy/contract/:chainId',
		{
			schema: DeployContractSchema
		},
		async (request, reply) => {
			logRequest(request)

			let tenderlyUrl: string | null = null
			let txHash: string | null = null
			const { chainId } = request.params

			try {
				const { args, abi, bytecode } = request.body

				if (!bytecode.startsWith('0x')) {
					logError(request, new Error('Bytecode must start with 0x'), {
						bytecode
					})
					return reply.code(400).send({
						result: {
							txHash: null,
							txUrl: null,
							deployedContractAddress: null,
							error: 'Bytecode must start with 0x'
						}
					})
				}

				const signer = await getSigner(chainId)
				logStep(request, 'Signer received', { signer: signer.account?.address })

				const txService = new TransactionService(fastify)

				const data = encodeDeployData({
					abi,
					bytecode: bytecode as `0x${string}`,
					args
				})
				logStep(request, 'Deploy data prepared', { data })

				const deploymentTx: TenderlyTransaction = {
					data,
					to: zeroAddress
				}

				logStep(request, 'Sending deploy transaction...')
				const tx = await signer.sendTransaction({
					data
				})
				txHash = tx.hash
				logStep(request, 'Deploy transaction sent', { txHash: tx.hash })

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

				const receipt = await tx.wait()
				logStep(request, 'Deploy transaction mined', { receipt })

				const deployedContractAddress = getContractAddressFromEvent(
					receipt,
					'CreatedContract(address)'
				)

				if (receipt?.status === 0) {
					logError(request, new Error('Transaction reverted'), { receipt })
					throw new Error('Transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi,
					data,
					txHash: receipt?.hash ?? '',
					isDeployTx: true,
					args
				})
				logStep(request, 'Transaction added in db', { txHash: receipt?.hash })

				logStep(request, 'Deploy transaction success', {
					txHash: receipt?.hash
				})
				return reply.code(200).send({
					result: {
						txHash: receipt?.hash ?? null,
						txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
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
					error instanceof Error
						? error.message
						: 'Failed to deploy contract'
				return reply.code(500).send({
					result: {
						txHash: finalTxHash,
						txUrl: finalTxHash ? getBlockExplorerUrl(Number(chainId), finalTxHash) : null,
						txSimulationUrl: tenderlyUrl,
						deployedContractAddress: null,
						error: errorMessage
					}
				})
			}
		}
	)
}
