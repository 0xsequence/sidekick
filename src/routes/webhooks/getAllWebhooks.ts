import type { FastifyInstance } from "fastify";
import { SequenceIndexer, type WebhookListener } from "@0xsequence/indexer";

export type GetAllWebhooksResponse = {
    result?: {
        data: {
            webhooks: WebhookListener[];
        },
        error?: string;
    };
}

export async function getAllWebhooks(fastify: FastifyInstance) {
    fastify.post<{
        Reply: GetAllWebhooksResponse;
    }>('/webhook/getAll', async (request, reply) => {
        try {
            const indexerClient = new SequenceIndexer(process.env.INDEXER_URL!, process.env.PROJECT_ACCESS_KEY!, process.env.INDEXER_SECRET_KEY!)

            const response = await indexerClient.getAllWebhookListeners({})

            return reply.code(200).send({
                result: {
                    data: {
                        webhooks: response.listeners
                    }
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    data: {
                        webhooks: [],
                    },
                    error: error instanceof Error ? error.message : 'Failed to get all webhooks'
                }
            });
        }
    });
}