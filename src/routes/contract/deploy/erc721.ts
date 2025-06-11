import type { FastifyInstance } from 'fastify'
import { encodeAbiParameters, encodeDeployData, zeroAddress } from 'viem'
import { erc721Abi } from '~/constants/abis/erc721'
import { erc721bytecode } from '~/constants/bytecodes/erc721'
import { erc721JsonInputMetadata } from '~/constants/contractJsonInputs/erc721'
import {
	type TenderlyTransaction,
	getTenderlySimulationUrl,
	prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import { verifyContract } from '~/utils/contractVerification'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { getBlockExplorerUrl, getContractAddressFromEvent } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type ERC721DeployRequestBody = {
	defaultAdmin: string
	minter: string
	name: string
	symbol: string
}

type ERC721DeployRequestParams = {
	chainId: string
}

type ERC721DeployResponse = {
	result?: {
		txHash: string | null
		txUrl: string | null
		txSimulationUrl?: string | null
		deployedContractAddress: string | null
		error?: string
	}
}

const ERC721DeploySchema = {
	tags: ['ERC721', 'Deploy'],
	description:
		'Deploy an ERC721 contract by providing the default admin, minter, name and symbol',
	body: {
		type: 'object',
		required: ['defaultAdmin', 'minter', 'name', 'symbol'],
		properties: {
			defaultAdmin: { type: 'string' },
			minter: { type: 'string' },
			name: { type: 'string' },
			symbol: { type: 'string' }
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
				result: { type: 'object', properties: { error: { type: 'string' } } }
			}
		}
	}
}

export async function erc721Deploy(fastify: FastifyInstance) {
	fastify.post<{
		Params: ERC721DeployRequestParams
		Body: ERC721DeployRequestBody
		Reply: ERC721DeployResponse
	}>(
		'/deploy/erc721/:chainId',
		{
			schema: ERC721DeploySchema
		},
		async (request, reply) => {
			const tenderlyUrl: string | null = null
			try {
				logRequest(request)

				const { chainId } = request.params
				const { defaultAdmin, minter, name, symbol } = request.body

				logStep(request, 'Getting tx signer', { chainId })
				const signer = await getSigner(chainId)
				logStep(request, 'Tx signer received', {
					signer: signer.account.address
				})

				logStep(request, 'Preparing deploy data', {
					abi: erc721Abi,
					bytecode: erc721bytecode,
					args: [defaultAdmin, minter, name, symbol]
				})
				const data = encodeDeployData({
					abi: erc721Abi,
					bytecode: erc721bytecode as `0x${string}`,
					args: [defaultAdmin, minter, name, symbol]
				})

				const deploymentTx: TenderlyTransaction = {
					data,
					to: zeroAddress
				}

				logStep(request, 'Sending deploy transaction', { data })
				const tx = await signer.sendTransaction({
					data
				})
				logStep(request, 'Deploy transaction sent', { tx })

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

				logStep(request, 'Waiting for deploy receipt', { txHash: tx.hash })
				const receipt = await tx.wait()
				logStep(request, 'Deploy receipt received', { receipt })

				const deployedContractAddress = getContractAddressFromEvent(
					receipt,
					'CreatedContract(address)'
				)

				if (receipt?.status === 0) {
					logError(request, new Error('Transaction reverted'), { receipt })
					throw new Error('Transaction reverted')
				}

				logStep(request, 'Creating transaction record in db', {
					chainId,
					contractAddress: receipt?.contractAddress ?? '',
					abi: erc721Abi,
					data,
					txHash: receipt?.hash ?? '',
					isDeployTx: true
				})
				const txService = new TransactionService(fastify)
				await txService.createTransaction({
					chainId,
					contractAddress: deployedContractAddress,
					abi: erc721Abi,
					data,
					txHash: receipt?.hash ?? '',
					isDeployTx: true
				})

				logStep(request, 'Deploy transaction success', {
					txHash: receipt?.hash
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
							{ name: 'name', type: 'string' },
							{ name: 'symbol', type: 'string' }
						],
						[
							defaultAdmin as `0x${string}`,
							minter as `0x${string}`,
							name,
							symbol
						]
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
						contractInputMetadata: erc721JsonInputMetadata,
						constructorArguments: encodedArgsNoPrefix
					})

					logStep(request, 'Contract verification response: ', { response })
				}
				// --- End verification logic ---

				return reply.code(200).send({
					result: {
						txHash: receipt?.hash ?? null,
						txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
						txSimulationUrl: tenderlyUrl,
						deployedContractAddress: deployedContractAddress
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
						txSimulationUrl: tenderlyUrl,
						deployedContractAddress: null,
						error:
							error instanceof Error ? error.message : 'Failed to deploy ERC721'
					}
				})
			}
		}
	)
}
