import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';

const CACHE_KEY = 'recent_transactions';
const CACHE_TTL = 60; 

export async function getTransactions(fastify: FastifyInstance) {
  fastify.get('/transactions', async (request, reply) => {
    try {
      // Try to get from cache first
      const cached = await fastify.redis.get(CACHE_KEY);
      if (cached) {
        return reply.code(200).send({
          transactions: JSON.parse(cached),
          fromCache: true
        });
      }

      // If not in cache, get from database
      const transactions = await prisma.transaction.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });

    //   // Cache the result
      await fastify.redis.setex(
        CACHE_KEY, 
        CACHE_TTL,
        JSON.stringify(transactions)
      );

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
