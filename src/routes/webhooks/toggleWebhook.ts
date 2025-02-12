import type { FastifyInstance } from "fastify";
import { SequenceIndexer, type WebhookListener } from "@0xsequence/indexer";

export type ToggleWebhookResponse = {
    result?: {
        data: {
            webhook: WebhookListener | null;
        };
        error?: string;
    };
}

type ToggleWebhookRequestBody = {
    webhookId: string;
}

const ToggleWebhookSchema = {
    tags: ['Webhooks'],
    headers: {
        type: 'object',
        properties: {
            'x-secret-key': { type: 'string' }
        },
        required: ['x-secret-key']
    },
    body: {
        type: 'object',
        properties: {
            webhookId: { type: 'string' }
        },
        required: ['webhookId']
    }
}

export async function resumeAllWebhooks(fastify: FastifyInstance) {
    fastify.post<{
        Reply: ToggleWebhookResponse;
        Body: ToggleWebhookRequestBody;
    }>('/webhook/toggle', {
        schema: ToggleWebhookSchema
    }, async (request, reply) => {
        try {
            const { webhookId } = request.body;

            const indexerClient = new SequenceIndexer(process.env.INDEXER_URL!, process.env.PROJECT_ACCESS_KEY!, process.env.INDEXER_SECRET_KEY!)

            const response = await indexerClient.toggleWebhookListener({ id: Number(webhookId) })

            return reply.code(200).send({
                result: {
                    data: {
                        webhook: response.webhookListener
                    }
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: {
                        webhook: null,
                    },
                    error: error instanceof Error ? error.message : 'Failed to toggle webhook'
                }
            });
        }
    });
}