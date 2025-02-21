import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';

export async function getTransactions(fastify: FastifyInstance) {
  fastify.get('/transactions', {
    schema: {
      tags: ['Transactions'],
      summary: 'Get all transactions',
      description: 'Get all transactions from the database',
    },
  }, async (request, reply) => {
    try {
      const transactions = await prisma.transaction.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });

      return reply.code(200).send({
        transactions,
        fromCache: false
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch transactions'
      });
    }
  });
}
