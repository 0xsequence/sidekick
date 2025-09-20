import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

export default fp(async (fastify: FastifyInstance) => {
	await fastify.register(swagger, {
		openapi: {
			info: {
				title: 'Sequence Sidekick API',
				description: 'API for interacting with smart contracts',
				version: '1.0.0'
			},
			servers: [
				{
					url: '/',
					description: 'Local Development Server'
				}
			],
			components: {
				securitySchemes: {
					apiKey: {
						type: 'apiKey',
						name: 'x-secret-key',
						in: 'header'
					}
				}
			}
		}
	})

	await fastify.register(swaggerUi, {
		routePrefix: '/documentation',
		uiConfig: {
			docExpansion: 'list',
			deepLinking: false
		},
		staticCSP: false,
		transformStaticCSP: (header) => header
	})
})
