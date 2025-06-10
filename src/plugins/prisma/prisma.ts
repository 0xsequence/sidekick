import type { PrismaClient } from '~/lib/generated/prismaClient'
import fp from 'fastify-plugin'
import { prismaClient } from '~/lib/prisma'

declare module 'fastify' {
	interface FastifyInstance {
		prisma: PrismaClient
	}
}

export default fp(async (fastify) => {
	// Make Prisma available through the fastify instance
	fastify.decorate('prisma', prismaClient)

	fastify.addHook('onClose', async (instance) => {
		await instance.prisma.$disconnect()
	})
})
