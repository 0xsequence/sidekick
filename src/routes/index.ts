import type { FastifyInstance } from 'fastify';
import { readContract } from './contract/read/read';
import { writeContract } from './contract/write/write';
import { getSigner } from '../utils';
import { erc20Transfer } from './contract/extensions/erc20/write/transfer';
import { erc20Approve } from './contract/extensions/erc20/write/approve';
import { getAbi } from './contract/utils/abi/abi';
import { erc721SafeMint } from './contract/extensions/erc721/write/safeMint';
import { erc721BalanceOf } from './contract/extensions/erc721/read/balanceOf';
import { getTransactions } from './transactions/transactions';
import { importContracts } from './contract/utils/importContracts/importContracts';
import { addContract } from './contract/utils/addContract/addContract';
import { erc721SafeMintBatch } from './contract/extensions/erc721/write/safeMintBatch';

export default async function (fastify: FastifyInstance) {
    // Health check route
    fastify.get('/', async (request, reply) => {
        return reply.code(200).send({
            status: 'ok'
        });
    });

    //   Get engine sender address
    fastify.get('/engine/smart-account-address', async (request, reply) => {
        const chainId = '1';
        const signer = await getSigner(chainId);
        return reply.code(200).send({
            address: await signer.getAddress()
        });
    });

    // Register contract routes
    readContract(fastify);
    writeContract(fastify);

    // Register erc20 routes
    erc20Transfer(fastify);
    erc20Approve(fastify);

    // Register abi route
    getAbi(fastify);

    // Register erc721 routes
    erc721SafeMint(fastify);
    erc721SafeMintBatch(fastify);
    erc721BalanceOf(fastify);

    // Register transactions route
    getTransactions(fastify);

    // Register import contracts route
    importContracts(fastify);

    // Register add contract route
    addContract(fastify);
}
