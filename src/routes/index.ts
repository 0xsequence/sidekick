import { ChainId } from '@0xsequence/network'
import type { FastifyInstance } from 'fastify'
import metrics from '../plugins/metrics/metrics'

import { getSigner } from '../utils/wallet'
import { deployContract } from './contract/deploy/contract'
import { erc20Deploy } from './contract/deploy/erc20'
import { erc721Deploy } from './contract/deploy/erc721'
import { erc721ItemsDeployAndInitialize } from './contract/deploy/erc721Items'
import { erc1155Deploy } from './contract/deploy/erc1155'
import { erc1155ItemsDeploy } from './contract/deploy/erc1155Items'
import { deployUpgradeableContract } from './contract/deploy/upgradeableContract'
import { readContract } from './contract/read/read'
import { simulateDeployment } from './contract/simulate/simulateDeployment'
import { simulateTransaction } from './contract/simulate/simulateTransaction'
import { addContract } from './contract/utils/addContract/addContract'
import { checkForInternalReverts } from './contract/utils/debug/checkForInternalReverts'
import { getDecodedTrace } from './contract/utils/debug/getDecodedTrace'
import { getRawTrace } from './contract/utils/debug/getRawTrace'
import { getAllContracts } from './contract/utils/get/getAllContracts'
import { getContract } from './contract/utils/get/getContract'
import { importContracts } from './contract/utils/importContracts/importContracts'
import { isDeployed } from './contract/utils/isDeployed/isDeployed'
import { getTxHashForMetaTxHash } from './contract/utils/relayer/getTxHashForMetaTxHash'
import { getTxReceipt } from './contract/utils/relayer/getTxReceipt'
import { verifyContract } from './contract/utils/verify/verify'
import { writeContract } from './contract/write/write'
import { cleanJobs } from './jobs/cleanJobs'
import { getJobs } from './jobs/getJobs'
import { startRewards } from './jobs/rewards/startRewards'
import { stopRewards } from './jobs/rewards/stopRewards'
import { getTransactions } from './transactions/getAllTransactions'
import { getTransactionByHash } from './transactions/getTransactionByHash'
import { addWebhook } from './webhooks/addWebhook'
import { getAllWebhooks } from './webhooks/getAllWebhooks'
import { removeAllWebhooks } from './webhooks/removeAllWebhooks'
import { removeWebhook } from './webhooks/removeWebhook'
import { registerErc721ItemsRoutes } from './contract/extensions/erc721Items'
import { registerErc1155ItemsRoutes } from './contract/extensions/erc1155Items'
import { registerErc20Routes } from './contract/extensions/erc20'
import { registerErc721Routes } from './contract/extensions/erc721'
import { registerErc1155Routes } from './contract/extensions/erc1155'

export default async function (fastify: FastifyInstance) {
	// Health check route
	fastify.get('/', async (request, reply) => {
		return reply.code(200).send({
			status: 'ok'
		})
	})

	// Get sidekick wallet address
	// A Sequence smart wallet is created for your PRIVATE KEY
	fastify.get(
		'/sidekick/wallet-address',
		{
			schema: {
				description: 'Get the Sequence smart wallet address for your Sidekick',
				tags: ['Sidekick'],
				response: {
					200: {
						type: 'object',
						properties: {
							address: { type: 'string', description: 'The wallet address' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const chainId = ChainId.MAINNET
			const signer = await getSigner(chainId.toString())
			return reply.code(200).send({
				address: await signer.getAddress()
			})
		}
	)

	// Register metrics plugin
	await fastify.register(metrics)

	// Register contract routes
	readContract(fastify)
	writeContract(fastify)
	getAllContracts(fastify)
	getContract(fastify)

	// Register is deployed route
	isDeployed(fastify)

	// Register deploy routes
	erc721Deploy(fastify)
	erc721ItemsDeployAndInitialize(fastify)
	erc20Deploy(fastify)
	erc1155Deploy(fastify)
	erc1155ItemsDeploy(fastify)
	deployContract(fastify)
	deployUpgradeableContract(fastify)

	// Register transactions route
	getTransactions(fastify)
	getTransactionByHash(fastify)

	// Register import contracts route
	importContracts(fastify)

	// Register add contract route
	addContract(fastify)

	// Register relayer routes
	getTxReceipt(fastify)
	getTxHashForMetaTxHash(fastify)

	// Register debug routes
	getRawTrace(fastify)
	getDecodedTrace(fastify)
	checkForInternalReverts(fastify)

	// Webhooks
	addWebhook(fastify)
	removeWebhook(fastify)
	removeAllWebhooks(fastify)
	getAllWebhooks(fastify)

	// Jobs
	startRewards(fastify)
	stopRewards(fastify)
	getJobs(fastify)
	cleanJobs(fastify)

	// Simulate transaction
	simulateDeployment(fastify)
	simulateTransaction(fastify)

	// Contract verification
	verifyContract(fastify)

	registerErc721ItemsRoutes(fastify)
	registerErc1155ItemsRoutes(fastify)
	registerErc20Routes(fastify)
	registerErc721Routes(fastify)
	registerErc1155Routes(fastify)
}