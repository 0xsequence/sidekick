import type { FastifyInstance } from "fastify";
import { getTenderlySimulationUrl } from "../utils/tenderly/getSimulationUrl";
import { TENDERLY_SIMULATION_URL } from "../../../constants/general";

// Types for request/response
type SimulateTransactionBody = {
    callData: string;
    chainId: number;
    from: string;
    gas: number;
    blockNumber: number;
    contractFunction: string;
    to: string;
    gasPrice?: number;
    value?: number;
    simulationType?: 'quick' | 'full';
    functionInputs?: any[];
}

type SimulateTransactionResponse = {
    result?: {
        transaction: any;
        simulation: any;
        contracts: any;
        generated_access_list: any;
        error?: string;
        tenderlySimulationUrl?: string;
    };
}

const SimulateTransactionSchema = {
    description: 'Simulate a transaction',
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
            to: {
                type: 'string',
                description: 'To address'
            },
            contractFunction: {
                type: 'string',
                description: 'Contract function'
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
                description: 'Function arguments',
                items: { type: 'string' },
                nullable: true
            }
        }
    },
    headers: {
        type: 'object',
        required: ['x-secret-key'],
        properties: {
            'x-secret-key': { type: 'string' },
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
                        generated_access_list: { type: 'object', additionalProperties: true },
                        error: { type: 'string', nullable: true },
                        tenderlySimulationUrl: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function simulateTransaction(fastify: FastifyInstance) {
    fastify.post<{
        Body: SimulateTransactionBody;
        Reply: SimulateTransactionResponse;
    }>('/simulate/transaction', {
        schema: SimulateTransactionSchema
    }, async (request, reply) => {
        try {
            const { callData, chainId, from, to, gas, gasPrice, value, simulationType, blockNumber, contractFunction, functionInputs } = request.body;

            // Prepare payload as per Tenderly API docs
            const payload: Record<string, any> = {
                network_id: String(chainId), // Tenderly expects string
                block_number: blockNumber,
                from,
                gas,
                gas_price: gasPrice,
                value,
                input: callData,
                simulation_type: simulationType,
            };
            if (to) payload.to = to;

            // Remove undefined fields (Tenderly API does not like undefined)
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            // Call Tenderly API
            const simulation = await fetch(
                TENDERLY_SIMULATION_URL,
                {
                    method: 'POST',
                    headers: {
                        'X-Access-Key': process.env.TENDERLY_ACCESS_KEY as string,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                }
            );

            // Handle non-2xx responses
            if (!simulation.ok) {
                const errorText = await simulation.text();
                request.log.error({ status: simulation.status, errorText }, 'Tenderly API error');
                return reply.code(simulation.status).send({
                    result: {
                        transaction: null,
                        simulation: null,
                        contracts: null,
                        generated_access_list: null,
                        error: `Tenderly API error: ${errorText}`
                    }
                });
            }

            // Parse JSON response
            const data = await simulation.json();

            const tenderlyUrl = getTenderlySimulationUrl({
                chainId: chainId,
                from,
                gas,
                gasPrice,
                value: value?.toString(),
                block: blockNumber,
                blockIndex: 0,
                contractAddress: to,
                contractFunction,
                rawFunctionInput: callData,
                functionInputs
            });

            return reply.code(200).send({
                result: {
                    transaction: data.transaction,
                    simulation: data.simulation,
                    contracts: data.contracts,
                    generated_access_list: data.generated_access_list,
                    tenderlySimulationUrl: tenderlyUrl
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    transaction: null,
                    simulation: null,
                    contracts: null,
                    generated_access_list: null,
                    error: error instanceof Error ? error.message : 'Failed to read from contract'
                }
            });
        }
    });
}