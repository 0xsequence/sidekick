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

export default async function (fastify: FastifyInstance) {
    // Health check route
    fastify.get('/', async (request, reply) => {
        return reply.code(200).send({
            status: 'ok'
        });
    });

    //   Get sidekick owner address
    fastify.get('/sidekick/smart-account-address', async (request, reply) => {
        const chainId = '1';
        const signer = await getSigner(chainId);
        return reply.code(200).send({
            address: await signer.getAddress()
        });
    });

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

    // Register erc1155 routes
    erc1155Mint(fastify);
    erc1155MintBatch(fastify);
    erc1155GrantRole(fastify);
    erc1155HasRole(fastify);
    erc1155MinterRole(fastify);
    erc1155BalanceOf(fastify);
    // Register is deployed route
    isDeployed(fastify);

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
}
