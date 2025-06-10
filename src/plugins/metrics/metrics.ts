import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import client from 'prom-client'

const collectDefaultMetrics = client.collectDefaultMetrics

const httpRequestCounter = new client.Counter({
	name: 'http_requests_total',
	help: 'Total number of HTTP requests',
	labelNames: ['method', 'route', 'status_code']
})

const httpRequestDuration = new client.Histogram({
	name: 'http_request_duration_seconds',
	help: 'Duration of HTTP requests in seconds',
	labelNames: ['method', 'route', 'status_code'],
	buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
})

const activeConnectionsGauge = new client.Gauge({
	name: 'active_connections',
	help: 'Current number of active connections'
})

collectDefaultMetrics({
	// includes process_resident_memory_bytes, process_cpu_user_seconds_total, etc.
	prefix: ''
})

export default fp(async function metricsPlugin(fastify: FastifyInstance) {
	// Track active connections
	let activeConnections = 0
	fastify.server.on('connection', () => {
		activeConnections++
		activeConnectionsGauge.set(activeConnections)
	})
	fastify.server.on('close', () => {
		activeConnections = Math.max(0, activeConnections - 1)
		activeConnectionsGauge.set(activeConnections)
	})

	fastify.addHook('onRequest', async (request: FastifyRequest) => {
		// Attach start time for duration
		;(request as any)._startTime = process.hrtime()
	})

	fastify.addHook(
		'onResponse',
		async (request: FastifyRequest, reply: FastifyReply) => {
			const route = request.routeOptions?.url || request.url
			const method = request.method
			const statusCode = reply.statusCode
			httpRequestCounter.inc({ method, route, status_code: statusCode })
			// Duration
			const start = (request as any)._startTime
			if (start) {
				const diff = process.hrtime(start)
				const duration = diff[0] + diff[1] / 1e9
				httpRequestDuration.observe(
					{ method, route, status_code: statusCode },
					duration
				)
			}
		}
	)

	// /metrics route with token protection
	fastify.route({
		method: 'GET',
		url: '/metrics',
		schema: {
			hide: false,
			description: 'Prometheus metrics endpoint.',
			response: {
				200: { type: 'string', description: 'Prometheus metrics' }
			}
		},
		handler: async (request, reply) => {
			reply.header('Content-Type', client.register.contentType)
			return client.register.metrics()
		}
	})
})
