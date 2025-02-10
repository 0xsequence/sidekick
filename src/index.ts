import Fastify from 'fastify';
import auth from './middleware/auth';
import FastifyRedis from '@fastify/redis'

const fastify = Fastify({
    logger: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
                colorize: true,
                levelFirst: true,
                messageFormat: '{msg} {reqId}',
            }
        }
    },
    connectionTimeout: 60000,
    ajv: {
        customOptions: {
            removeAdditional: false,
            useDefaults: true,
            coerceTypes: true,
            allErrors: true
        }
    }
});

// Register Redis plugin
fastify.register(FastifyRedis, {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || 'sequence',
    closeClient: true
})

// Then register routes
await fastify.register(import('./routes'));

fastify.addHook('preHandler', auth);

// Start server
try {
    await fastify.listen({ 
        port: Number(process.env.PORT || 3000), 
        host: process.env.HOST || '0.0.0.0' // This ensures the server is accessible from outside
    });
    fastify.log.info('\n=== Database Connection Details ===');
    fastify.log.info(`DATABASE_URL: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***:***@')}`);
    fastify.log.info('============================\n');
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}