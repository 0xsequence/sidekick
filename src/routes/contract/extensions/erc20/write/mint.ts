import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc20Abi } from "../../../../../constants/abis/erc20";
import { TransactionService } from "../../../../../services/transaction.service";
import { logRequest, logStep } from "../../../../../utils/loggingUtils";
import { TENDERLY_SIMULATION_URL } from "../../../../../constants/general";
import { getTenderlySimulationUrl } from "../../../utils/tenderly/getSimulationUrl";
import { commons } from "@0xsequence/core";

type ERC20MintRequestBody = {
    to: string;
    amount: string;
}

type ERC20MintRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC20MintResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC20MintSchema = {
    tags: ['ERC20'],
    body: {
        type: 'object',
        required: ['to', 'amount'],
        properties: {
            to: { type: 'string' },
            amount: { type: 'string' }
        }
    },
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' }
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
                        txHash: { type: 'string' },
                        txUrl: { type: 'string' },
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function erc20Mint(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC20MintRequestParams;
        Body: ERC20MintRequestBody;
        Reply: ERC20MintResponse;
    }>('/write/erc20/:chainId/:contractAddress/mint', {
        schema: ERC20MintSchema
    }, async (request, reply) => {
        try {
            logRequest(request);

            const { to, amount } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            const contract = new ethers.Contract(
                contractAddress,
                erc20Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'mint',
                [to, amount]
            );

            const tx = {
                to: contractAddress,
                data
            }
            logStep(request, 'Tx prepared', { tx });

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "mint", args: [to, amount] } });

            if(process.env.DEBUG === 'true') {

                // call execute on the smart account
                const simulationData = commons.transaction.encodeBundleExecData({
                    entrypoint: signer.account.address,
                    transactions: [
                        {
                            to: contractAddress,
                            data
                        }
                    ]
                })

                // Do I need to do this ?
                // const sequenceTransaction = commons.transaction.toSequenceTransaction(signer.account.address, tx)

                const payload: Record<string, any> = {
                    network_id: String(chainId), 
                    block_number: await signer.provider.getBlockNumber(),
                    from: signer.account.address,
                    to: signer.account.address,
                    gas: 3000000,
                    input: simulationData
                };

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

                const simulationResponse = await simulation.json();

                const tenderlyUrl = getTenderlySimulationUrl({
                    accountSlug: process.env.TENDERLY_ACCOUNT_SLUG as string,
                    projectSlug: process.env.TENDERLY_PROJECT_SLUG as string,
                    chainId: chainId,
                    gas: 3000000,
                    block: await signer.provider.getBlockNumber(),
                    blockIndex: 0,
                    contractAddress: signer.account.address, // On the smart wallet account
                    contractFunction: 'execute', // call execute
                    // craft the arguments for the execute contract method
                    functionInputs: [[ 
                        { 
                            to: contractAddress, // ERC20 token
                            data // mint
                        }
                    ], 0, new Uint8Array([])] // nonce, signature
                });
            }

            logStep(request, 'Sending mint transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'Mint transaction sent', { txHash: txResponse.hash });

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);
            logStep(request, 'Transaction status updated in db');

            logStep(request, 'Mint transaction success', { txHash: txResponse.hash });
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
                    error: error instanceof Error ? error.message : 'Failed to execute mint'
                }
            });
        }
    });
}
