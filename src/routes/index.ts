import type { FastifyInstance } from 'fastify';
import { readContract } from './contract/read/read';
import { writeContract } from './contract/write/write';
import { getSigner } from '../utils/wallet';
import { erc20Transfer } from './contract/extensions/erc20/write/transfer';
import { erc20Approve } from './contract/extensions/erc20/write/approve';
import { erc721SafeMint } from './contract/extensions/erc721/write/safeMint';
import { erc721BalanceOf } from './contract/extensions/erc721/read/balanceOf';
import { getTransactions } from './transactions/getAllTransactions';
import { importContracts } from './contract/utils/importContracts/importContracts';
import { addContract } from './contract/utils/addContract/addContract';
import { erc721SafeMintBatch } from './contract/extensions/erc721/write/safeMintBatch';
import { erc20Mint } from './contract/extensions/erc20/write/mint';
import { erc20TransferFrom } from './contract/extensions/erc20/write/transferFrom';
import { addWebhook } from './webhooks/addWebhook';
import { removeWebhook } from './webhooks/removeWebhook';
import { removeAllWebhooks } from './webhooks/removeAllWebhooks';
import { getAllWebhooks } from './webhooks/getAllWebhooks';
import { getAllContracts } from './contract/utils/get/getAllContracts';
import { getContract } from './contract/utils/get/getContract';
import { getTransactionByHash } from './transactions/getTransactionByHash';
import { erc1155Mint } from './contract/extensions/erc1155/write/mint';
import { erc1155GrantRole } from './contract/extensions/erc1155/write/grantRole';
import { erc1155MintBatch } from './contract/extensions/erc1155/write/mintBatch';
import { erc1155MinterRole } from './contract/extensions/erc1155/read/minterRole';
import { erc1155HasRole } from './contract/extensions/erc1155/read/hasRole';
import { isDeployed } from './contract/utils/isDeployed/isDeployed';
import { erc1155BalanceOf } from './contract/extensions/erc1155/read/balanceOf';
import { stopRewards } from './jobs/rewards/stopRewards';
import { startRewards } from './jobs/rewards/startRewards';
import { getJobs } from './jobs/getJobs';
import { cleanJobs } from './jobs/cleanJobs';
import { erc721Deploy } from './contract/deploy/erc721';
import { erc1155Deploy } from './contract/deploy/erc1155';
import { erc20Deploy } from './contract/deploy/erc20';
import { deployContract } from './contract/deploy/contract';
import { ChainId } from '@0xsequence/network';
import { erc721Burn } from './contract/extensions/erc721/write/burn';
import { erc721ItemsMint } from './contract/extensions/erc721/erc721Items/write/mint';
import { erc721ItemsDeployAndInitialize } from './contract/deploy/erc721Items';
import { deployUpgradeableContract } from './contract/deploy/upgradeableContract';
import { erc721ItemsBurn } from './contract/extensions/erc721/erc721Items/write/burn';
import { erc721ItemsBatchBurn } from './contract/extensions/erc721/erc721Items/write/batchBurn';
import { erc721ItemsInitialize } from './contract/extensions/erc721/erc721Items/write/initialize';
import { erc1155ItemsMint } from './contract/extensions/erc1155/erc1155Items/write/mint';
import { erc1155ItemsBurn } from './contract/extensions/erc1155/erc1155Items/write/burn';
import { erc1155ItemsInitialize } from './contract/extensions/erc1155/erc1155Items/write/initialize';
import { erc1155ItemsBatchBurn } from './contract/extensions/erc1155/erc1155Items/write/batchBurn';
import { erc1155ItemsDeploy } from './contract/deploy/erc1155Items';
import metrics from '../plugins/metrics/metrics';

export default async function (fastify: FastifyInstance) {
    // Health check route
    fastify.get('/', async (request, reply) => {
        return reply.code(200).send({
            status: 'ok'
        });
    });

    // Get sidekick wallet address
    // A Sequence smart wallet is created for your PRIVATE KEY
    fastify.get('/sidekick/wallet-address', {
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
    }, async (request, reply) => {
        const chainId = ChainId.MAINNET
        const signer = await getSigner(chainId.toString());
        return reply.code(200).send({
            address: await signer.getAddress()
        });
    });

    // Register metrics plugin
    await fastify.register(metrics);

    // Register contract routes
    readContract(fastify);
    writeContract(fastify);
    getAllContracts(fastify);
    getContract(fastify);

    // Register erc20 routes
    erc20Transfer(fastify);
    erc20Approve(fastify);
    erc20Mint(fastify);
    erc20TransferFrom(fastify);

    // Register erc721 routes
    erc721SafeMint(fastify);
    erc721SafeMintBatch(fastify);
    erc721BalanceOf(fastify);
    erc721Burn(fastify);
    
    // Register erc1155 routes
    erc1155Mint(fastify);
    erc1155MintBatch(fastify);
    erc1155GrantRole(fastify);
    erc1155HasRole(fastify);
    erc1155MinterRole(fastify);
    erc1155BalanceOf(fastify);

    // Register erc721Items routes
    erc721ItemsMint(fastify);
    erc721ItemsBurn(fastify);
    erc721ItemsBatchBurn(fastify);
    erc721ItemsInitialize(fastify);

    // Register erc1155Items routes
    erc1155ItemsMint(fastify);
    erc1155ItemsBurn(fastify);
    erc1155ItemsBatchBurn(fastify);
    erc1155ItemsInitialize(fastify);
    
    // Register is deployed route
    isDeployed(fastify);

    // Register deploy routes
    erc721Deploy(fastify);
    erc721ItemsDeployAndInitialize(fastify);
    erc20Deploy(fastify);
    erc1155Deploy(fastify);
    erc1155ItemsDeploy(fastify);
    deployContract(fastify);
    deployUpgradeableContract(fastify);

    // Register transactions route
    getTransactions(fastify);
    getTransactionByHash(fastify);

    // Register import contracts route
    importContracts(fastify);

    // Register add contract route
    addContract(fastify);

    // Webhooks
    addWebhook(fastify);
    removeWebhook(fastify);
    removeAllWebhooks(fastify);
    getAllWebhooks(fastify);

    // Jobs
    startRewards(fastify);
    stopRewards(fastify);
    getJobs(fastify);
    cleanJobs(fastify);
}
