import pino from 'pino'

const logger = pino({
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
			translateTime: 'HH:MM:ss Z',
			ignore: 'pid,hostname',
			levelFirst: true
		}
	}
})

export const checkConfig = () => {
	if (!process.env.EVM_PRIVATE_KEY) {
		logger.error('EVM_PRIVATE_KEY is missing.')
		process.exit(1)
	}
}
