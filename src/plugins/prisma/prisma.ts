import fp from 'fastify-plugin'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../../lib/prisma'

declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient
    }
}

export default fp(async (fastify) => {
    // Make Prisma available through the fastify instance
    fastify.decorate('prisma', prisma)

    fastify.addHook('onClose', async (instance) => {
        await instance.prisma.$disconnect()
    })
})