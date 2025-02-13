import type { FastifyInstance } from "fastify";
import {  type EventFilter } from "@0xsequence/indexer";
import { indexerClient } from "../../constants/general";

export type UpdateWebhookResponse = {
    result?: {
        data: {
            status: boolean;
        };
        error?: string;
    };
}

type UpdateWebhookRequestBody = {
    webhookId: string;
    url: string;
    filters: EventFilter;
    name: string;
    active: boolean;
    projectID: number;
}

const UpdateWebhookSchema = {
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
            webhookId: { type: 'string' },
            url: { type: 'string' },
            filters: { type: 'object' },
            name: { type: 'string' },
            active: { type: 'boolean' },
            projectID: { type: 'number' }
        },
        required: ['webhookId', 'url', 'filters', 'name', 'active', 'projectID']
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

export async function updateWebhook(fastify: FastifyInstance) {
    fastify.post<{
        Reply: UpdateWebhookResponse;
        Body: UpdateWebhookRequestBody;
    }>('/webhook/update', {
        schema: UpdateWebhookSchema
    }, async (request, reply) => {
        try {
            const { webhookId, url, filters, name, active, projectID } = request.body;

            const response = await indexerClient.updateWebhookListener({listener: {
                id: Number(webhookId),
                url,
                filters,
                name,
                projectID,
                updatedAt: new Date().toISOString(),
                active
            }})

            return reply.code(200).send({
                result: {
                    data: {
                        status: response.status
                    }
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: {
                        status: false,
                    },
                    error: error instanceof Error ? error.message : 'Failed to update webhook'
                }
            });
        }
    });
}