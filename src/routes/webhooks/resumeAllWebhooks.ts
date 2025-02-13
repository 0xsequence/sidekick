import type { FastifyInstance } from "fastify";
import { indexerClient } from "../../constants/general";

export type ResumeAllWebhooksResponse = {
    result?: {
        status: boolean;
        error?: string;
    };
}

const ResumeAllWebhooksSchema = {
    tags: ['Webhooks'],
    headers: {
        type: 'object',
        properties: {
            'x-secret-key': { type: 'string' }
        },
        required: ['x-secret-key']
    }
}

export async function resumeAllWebhooks(fastify: FastifyInstance) {
    fastify.post<{
        Reply: ResumeAllWebhooksResponse;
    }>('/webhook/resumeAll', {
        schema: ResumeAllWebhooksSchema
    }, async (request, reply) => {
        try {
            const response = await indexerClient.resumeAllWebhookListeners({})

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
                    error: error instanceof Error ? error.message : 'Failed to resume all webhooks'
                }
            });
        }
    });
}