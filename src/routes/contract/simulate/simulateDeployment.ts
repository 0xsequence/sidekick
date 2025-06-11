import type { FastifyInstance } from 'fastify'
import { TENDERLY_SIMULATION_URL } from '~/constants/general'
import { getTenderlySimulationUrl } from '~/routes/contract/utils/tenderly/getSimulationUrl'

// Types for request/response
type SimulateDeploymentBody = {
	callData: string
	chainId: number
	from: string
	gas: number
	blockNumber: number
	gasPrice?: number
	value?: number
	simulationType?: 'quick' | 'full'
	functionInputs?: unknown[]
}

type SimulationResponse = {
	transaction: unknown
	simulation: unknown
	contracts: unknown
	generated_access_list: unknown
}

type SimulateDeploymentResponse = {
	result?: {
		transaction: unknown
		simulation: unknown
		contracts: unknown
		generated_access_list: unknown
		error?: string
		tenderlySimulationUrl?: string
	}
}

const SimulateDeploymentSchema = {
	description: 'Simulate a contract deployment',
	tags: ['Contract', 'Simulate'],
	body: {
		type: 'object',
		required: ['callData', 'chainId', 'from', 'gas', 'blockNumber'],
		properties: {
			callData: {
				type: 'string',
				description: 'Call data to simulate'
			},
			chainId: {
				type: 'number',
				description: 'Chain ID'
			},
			from: {
				type: 'string',
				description: 'From address'
			},
			gas: {
				type: 'number',
				description: 'Gas'
			},
			blockNumber: {
				type: 'number',
				description: 'Block number'
			},
			gasPrice: {
				type: 'number',
				description: 'Gas price',
				nullable: true
			},
			value: {
				type: 'number',
				description: 'Value',
				nullable: true
			},
			simulationType: {
				type: 'string',
				nullable: true,
				description: 'Simulation type',
				enum: ['quick', 'full']
			},
			functionInputs: {
				type: 'array',
				description: 'Constructor arguments',
				items: { type: 'string' },
				nullable: true
			}
		},
		additionalProperties: false
	},
	headers: {
		type: 'object',
		properties: {
			'x-secret-key': { type: 'string', nullable: true }
		}
	},
	response: {
		200: {
			type: 'object',
			properties: {
				result: {
					type: 'object',
					properties: {
						transaction: { type: 'object', additionalProperties: true },
						simulation: { type: 'object', additionalProperties: true },
						contracts: { type: 'object', additionalProperties: true },
						generated_access_list: {
							type: 'object',
							additionalProperties: true
						},
						error: { type: 'string', nullable: true },
						tenderlySimulationUrl: { type: 'string', nullable: true }
					}
				}
			}
		}
	}
}

export async function simulateDeployment(fastify: FastifyInstance) {
	fastify.post<{
		Body: SimulateDeploymentBody
		Reply: SimulateDeploymentResponse
	}>(
		'/simulate/deployment',
		{
			schema: SimulateDeploymentSchema
		},
		async (request, reply) => {
			try {
				const {
					callData,
					chainId,
					from,
					gas,
					gasPrice,
					value,
					simulationType,
					blockNumber,
					functionInputs,
					...rest
				} = request.body

				// Prepare payload as per Tenderly API docs
				const payload: Record<string, unknown> = {
					network_id: String(chainId), // Tenderly expects string
					block_number: blockNumber,
					from,
					gas,
					gas_price: gasPrice,
					value,
					input: callData,
					simulation_type: simulationType
				}

				// Remove undefined fields (Tenderly API does not like undefined)
				for (const key of Object.keys(payload)) {
					if (payload[key] === undefined) {
						delete payload[key]
					}
				}

				// Call Tenderly API
				const simulation = await fetch(TENDERLY_SIMULATION_URL, {
					method: 'POST',
					headers: {
						'X-Access-Key': process.env.TENDERLY_ACCESS_KEY as string,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				})

				// Handle non-2xx responses
				if (!simulation.ok) {
					const errorText = await simulation.text()
					request.log.error(
						{ status: simulation.status, errorText },
						'Tenderly API error'
					)
					return reply.code(simulation.status).send({
						result: {
							transaction: null,
							simulation: null,
							contracts: null,
							generated_access_list: null,
							error: `Tenderly API error: ${errorText}`
						}
					})
				}

				// Parse JSON response
				const data: SimulationResponse =
					(await simulation.json()) as SimulationResponse

				const tenderlyUrl = getTenderlySimulationUrl({
					chainId: chainId,
					from,
					gas,
					gasPrice,
					value: value?.toString(),
					block: blockNumber,
					blockIndex: 0,
					rawFunctionInput: callData,
					functionInputs
				})

				return reply.code(200).send({
					result: {
						transaction: data.transaction,
						simulation: data.simulation,
						contracts: data.contracts,
						generated_access_list: data.generated_access_list,
						tenderlySimulationUrl: tenderlyUrl
					}
				})
			} catch (error) {
				request.log.error(error)
				return reply.code(500).send({
					result: {
						transaction: null,
						simulation: null,
						contracts: null,
						generated_access_list: null,
						error:
							error instanceof Error
								? error.message
								: 'Failed to read from contract'
					}
				})
			}
		}
	)
}
