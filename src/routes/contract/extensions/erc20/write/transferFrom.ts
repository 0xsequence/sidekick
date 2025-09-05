import type { TransactionResponse } from 'ethers'
import { ethers } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { erc20Abi } from '~/constants/abis/erc20'
import {
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC20TransferFromRequestBody = {
	from: string
	to: string
	amount: string
}

type ERC20TransferFromRequestParams = {
	chainId: string
	contractAddress: string
}

type ERC20TransferFromResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		error?: string
	}
}

const ERC20TransferFromSchema = {
	tags: ['ERC20'],
	body: {
		type: 'object',
		required: ['from', 'to', 'amount'],
		properties: {
			from: { type: 'string' },
			to: { type: 'string' },
			amount: { type: 'string' }
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

export async function erc20TransferFrom(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC20TransferFromRequestParams
		Body: ERC20TransferFromRequestBody
		Reply: ERC20TransferFromResponse
	}>(
		'/write/erc20/:chainId/:contractAddress/transferFrom',
		{
			schema: ERC20TransferFromSchema
		},
		async (request, reply) => {
			let tenderlyUrl: string | null = null

			try {
				logRequest(request)

				const { from, to, amount } = request.body
				const { chainId, contractAddress } = request.params

				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				const contract = new ethers.Contract(contractAddress, erc20Abi, signer)

				const data = contract.interface.encodeFunctionData('transferFrom', [
					from,
					to,
					amount
				])

				const tx = {
					to: contractAddress,
					data
				}
				logStep(request, 'Tx prepared', { tx })

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

				const txService = new TransactionService(fastify)

				logStep(request, 'Sending transferFrom transaction...')
				const txResponse: TransactionResponse = await signer.sendTransaction(tx)
				logStep(request, 'TransferFrom transaction sent', {
					txHash: txResponse.hash
				})

				const receipt = await txResponse.wait()

				if (receipt?.status === 0) {
					throw new Error('Transaction reverted')
				}

				await txService.createTransaction({
					chainId,
					contractAddress,
					abi: erc20Abi,
					data: tx.data,
					txHash: receipt?.hash ?? '',
					isDeployTx: false,
					args: [from, to, amount],
					functionName: 'transferFrom'
				})

				logStep(request, 'TransferFrom transaction success', {
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
						error:
							error instanceof Error
								? error.message
								: 'Failed to execute transfer'
					}
				})
			}
		}
	)
}
