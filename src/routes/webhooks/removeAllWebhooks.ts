import type { FastifyInstance } from "fastify";
import { indexerClient } from "../../constants/general";

export type RemoveAllWebhooksResponse = {
    result?: {
        status: boolean;
        error?: string;
    };
}

const RemoveAllWebhooksSchema = {
    tags: ['Webhooks'],
    headers: {
        type: 'object',
        properties: {
            'x-secret-key': { type: 'string' }
        },
        required: ['x-secret-key']
    }
}

export async function removeAllWebhooks(fastify: FastifyInstance) {
    fastify.post<{
        Reply: RemoveAllWebhooksResponse;
    }>('/webhook/removeAll', {
        schema: RemoveAllWebhooksSchema
    }, async (request, reply) => {
        try {
            const response = await indexerClient.removeAllWebhookListeners({})

            return reply.code(200).send({
                result: {
                    status: response.status
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    status: false,
                    error: error instanceof Error ? error.message : 'Failed to remove all webhooks'
                }
            });
        }
    });
}