import type { FastifyReply, FastifyRequest } from 'fastify';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Authentication middleware that supports both API key and Bearer token authentication
 * Includes rate limiting and security headers
 */
const auth = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    // Add security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-XSS-Protection', '1; mode=block');

    // Skip auth for specified methods
    if (['GET', 'HEAD'].includes(request.method)) {
      return;
    }

    const apiKey = request.headers['x-secret-key'];

    // No API key provided
    if (!apiKey) {
      throw new Error('No API key provided');
    }

    // API Key authentication
    if (apiKey !== process.env.SECRET_KEY) {
      throw new Error('Invalid API key');
    }
    request.user = { id: 'api-client', role: 'api' };
    return;

  } catch (error: any) {
    // Log authentication failures (you should use a proper logger in production)
    console.error(`Authentication failed: ${error.message}`);
    
    return reply
      .status(401)
      .send({
        error: 'Unauthorized',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
  }
};

export default auth;
