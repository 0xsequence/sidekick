import type { FastifyInstance } from 'fastify';

export default async function testErrorRoute(fastify: FastifyInstance) {
  fastify.route({
    method: 'GET',
    url: '/test-error',
    schema: {
      tags: ['Test'],
      summary: 'Always returns a 500 error for testing Prometheus alerts',
      response: {
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    handler: async (_request, reply) => {
      reply.code(500).send({ error: 'This is a test 500 error.' });
    }
  });
} 