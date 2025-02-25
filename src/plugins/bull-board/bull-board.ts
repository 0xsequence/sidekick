import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export default fp(async (fastify: FastifyInstance) => {
    const serverAdapter = new FastifyAdapter();

    createBullBoard({
        queues: [new BullAdapter(fastify.rewardQueue)],
        serverAdapter
    });

    serverAdapter.setBasePath('/admin/queues');
    fastify.register(serverAdapter.registerPlugin(), {
        prefix: '/admin/queues',
        basePath: '/admin/queues'
    });

    fastify.log.info('Bull Board available at /admin/queues');
}); 