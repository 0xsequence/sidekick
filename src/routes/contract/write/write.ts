import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import type { InterfaceAbi, TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../utils/other'
import { TransactionService } from '../../../services/transaction.service';
import { AbiSchema } from "../../../schemas/contractSchemas";
// Types for request/response
type WriteRequestBody = {
    abi?: InterfaceAbi;
    args?: Array<string>;
}

type WriteRequestParams = {
    chainId: string;
    contractAddress: string;
    functionName: string;
}

export type WriteContractResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const WriteContractSchema = {
    description: 'Write to a smart contract',
    tags: ['Contract'],
    body: {
        type: 'object',
        properties: {
            args: {
                type: 'array',
                items: {
                    type: 'string'
                },
                description: 'JSON stringified array of function arguments'
            },
            abi: {
                type: 'array',
                items: AbiSchema,
                description: 'Contract ABI in JSON format. If not provided, the ABI will be fetched from the sidekick database, make sure the contract is added to the database first or pass the abi manually.'
            }
        }
    },
    headers: {
        type: 'object',
        required: ['x-secret-key'],
        properties: {
            'x-secret-key': { type: 'string' }
        }
    },
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress', 'functionName'],
        properties: {
            chainId: {
                type: 'string',
                description: 'Chain ID of the network'
            },
            contractAddress: {
                type: 'string',
                description: 'Contract address'
            },
            functionName: {
                type: 'string',
                description: 'Function name to call'
            }
        }
    },
    response: {
        200: {
            description: 'Successful response',
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        txHash: { type: 'string', nullable: true },
                        txUrl: { type: 'string', nullable: true },
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function writeContract(fastify: FastifyInstance) {
    fastify.post<{ 
        Params: WriteRequestParams;
        Body: WriteRequestBody;
        Reply: WriteContractResponse;
    }>('/write/contract/:chainId/:contractAddress/:functionName', {
        schema: WriteContractSchema
    }, async (request, reply) => {
        try {
            const { args, abi: abiFromBody } = request.body;
            const { chainId, contractAddress, functionName } = request.params;

            // Get the signer to use for the transaction
            const signer = await getSigner(chainId);

            let abiFromDb: ethers.InterfaceAbi | undefined;
            if (!abiFromBody) {
                const contract = await fastify.prisma.contract.findUnique({
                    where: {
                        contractAddress,
                        chainId: Number(chainId)
                    },
                })

                if(contract) {
                    if (!contract.abi) {
                        return reply.code(400).send({
                            result: {
                                txHash: null,
                                txUrl: null,
                                error: 'Contract ABI not found in db. Make sure the contract is added to the database first or pass the abi manually.'
                            }
                        })
                    }
                    abiFromDb = JSON.parse(contract.abi)
                } else {
                    return reply.code(400).send({
                        result: {
                            txHash: null,
                            txUrl: null,
                            error: 'Contract not found in db.'
                        }
                    })
                }
            }

            // Create contract instance with full ABI
            const contract = new ethers.Contract(
                contractAddress,
                abiFromBody ?? abiFromDb ?? [],
                signer
            );

            // Encode function data dynamically
            const data = contract.interface.encodeFunctionData(
                functionName,
                args ?? []
            );

            const tx = {
                to: contractAddress,
                data
            }

            const txService = new TransactionService(fastify);
            
            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({chainId, contractAddress, data: {functionName, args: args ?? []}});
            
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            
            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);

            return reply.code(200).send({
                result: {
                    txHash: txResponse.hash,
                    txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash)
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    error: error instanceof Error ? error.message : 'Failed to execute contract transaction'
                }
            });
        }
    });
}