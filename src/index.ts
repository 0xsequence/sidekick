import cors from '@fastify/cors'
import FastifyRedis from '@fastify/redis'
import Fastify from 'fastify'
import auth from './middleware/auth'
import bullBoard from './plugins/bull-board/bull-board'
import bull from './plugins/bull/bull'
import prisma from './plugins/prisma/prisma'
import swagger from './plugins/swagger/swagger'
import { checkConfig } from './utils/configCheck'

checkConfig()

const isDebug = process.env.DEBUG === 'true'

const fastify = Fastify({
	logger: {
		level: isDebug ? 'debug' : 'info',
		transport: {
			target: 'pino-pretty',
			options: {
				translateTime: 'HH:MM:ss Z',
				ignore: 'pid,hostname',
				colorize: true,
				levelFirst: true,
				messageFormat: '{msg} {reqId}'
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
})

// Register rate limit
await fastify.register(import('@fastify/rate-limit'), {
	max: 1000,
	timeWindow: '1 minute'
})

// Register CORS
await fastify.register(cors, {
	origin: true, // Allow all origins in development
	methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'x-secret-key'],
	credentials: true
})

// Register Prisma plugin if DATABASE_URL is set
if (process.env.DATABASE_URL) {
	await fastify.register(prisma)
}

// Register Swagger
await fastify.register(swagger)

// Register Redis plugin
if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
	fastify.register(FastifyRedis, {
		host: process.env.REDIS_HOST || 'localhost',
		port: Number(process.env.REDIS_PORT) || 6379,
		password: process.env.REDIS_PASSWORD,
		closeClient: true
	})
}

// Register Bull plugin
await fastify.register(bull)
await fastify.register(bullBoard)

// Then register routes
await fastify.register(import('./routes'))

fastify.addHook('preHandler', auth)

// Start server
try {
	await fastify.listen({
		port: Number(process.env.PORT || 7500),
		host: process.env.HOST || '0.0.0.0' // This ensures the server is accessible from outside
	})

	fastify.log.info(
		`Access swagger at http://localhost:${process.env.PORT || 7500}/documentation`
	)
} catch (err) {
	fastify.log.error(err)
	process.exit(1)
}
