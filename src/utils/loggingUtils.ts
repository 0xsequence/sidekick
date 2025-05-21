import type { FastifyRequest } from 'fastify';

export const logRequest = (request: FastifyRequest) => {
  request.log.debug({
    type: 'request',
    url: request.url,
    method: request.method,
    params: request.params,
    query: request.query,
    body: request.body,
    headers: request.headers,
  }, 'Incoming request');
};

export const logStep = (request: FastifyRequest, step: string, data?: Record<string, unknown>) => {
  request.log.debug({
    type: 'step',
    step,
    logData: data
  }, `Logging step: ${step}`);
};

export const logError = (request: FastifyRequest, error: unknown, context?: Record<string, unknown>) => {
  request.log.error({
    type: 'error',
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  }, 'Error occurred');
};
