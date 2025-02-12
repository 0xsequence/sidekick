import type { FastifyInstance } from "fastify";
import { SequenceIndexer, type WebhookListener } from "@0xsequence/indexer";

// Types for request/response
type AddWebhookRequestBody = {
    url: string;
    events: string[];
    contractAddresses: string[];
}

export type AddWebhookResponse = {
    result?: {
        data: {
            webhook: WebhookListener | null;
            status: boolean;
        }
        error?: string;
    };
}

const AddWebhookSchema = {
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
            url: { type: 'string' },
            events: { type: 'array', items: { type: 'string' } },
            contractAddresses: { type: 'array', items: { type: 'string' } },
        },
        required: ['url', 'events', 'contractAddresses'],
    },
    response: {
        200: {
            type: 'object',
            properties: {
                data: { type: 'object' }
            }
        }
    }
}

export async function addWebhook(fastify: FastifyInstance) {
    fastify.post<{
        Body: AddWebhookRequestBody;
        Reply: AddWebhookResponse;
    }>('/webhook/add', {
        schema: AddWebhookSchema
    }, async (request, reply) => {
        try {
            const { url, events, contractAddresses } = request.body;
            
            const indexerClient = new SequenceIndexer(process.env.INDEXER_URL!, process.env.PROJECT_ACCESS_KEY!, process.env.INDEXER_SECRET_KEY!)

            const response = await indexerClient.addWebhookListener({
                url,
                filters: {
                    contractAddresses,
                    events
                }
            })

            return reply.code(200).send({
                result: {
                    data: {
                        webhook: response.listener,
                        status: response.status
                    }
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: {
                        webhook: null,
                        status: false
                    },
                    error: error instanceof Error ? error.message : 'Failed to add webhook'
                }
            });
        }
    });
}