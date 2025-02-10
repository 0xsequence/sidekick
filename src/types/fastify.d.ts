import '@fastify/redis'
import { Redis } from 'ioredis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
    isRedisHealthy: () => Promise<boolean>
  }
}    