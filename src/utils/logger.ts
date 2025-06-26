import pino from 'pino'

export const logger = pino({
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
})
