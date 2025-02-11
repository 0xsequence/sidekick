import fp from 'fastify-plugin'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'

export default fp(async function (fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Sequence Engine API',
        description: 'API for interacting with smart contracts',
        version: '1.0.0'
      },
      servers: [{
        url: '/',
        description: 'Local Development Server'
      }],
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
      docExpansion: 'full',
      deepLinking: false
    },
    staticCSP: false,
    transformStaticCSP: (header) => header
  })
}) 