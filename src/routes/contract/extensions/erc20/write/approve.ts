import { getBlockExplorerUrl } from "../../../../../utils/other";
import { logRequest, logStep, logError } from '../../../../../utils/loggingUtils';

import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import { ethers } from "ethers";
import { erc20Abi } from "abitype/abis";
import type { TransactionResponse } from "ethers";
import { TransactionService } from "../../../../../services/transaction.service";
import { getTenderlySimulationUrl, prepareTransactionsForTenderlySimulation } from "../../../utils/tenderly/getSimulationUrl";

type ERC20ApproveRequestBody = {
    spender: string;
    amount: string;
}

type ERC20ApproveRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC20ApproveResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        txSimulationUrl?: string | null;
        error?: string;
    };
}

const ERC20ApproveSchema = {
    tags: ['ERC20'],
    body: {
        type: 'object',
        required: ['spender', 'amount'],
        properties: {
            spender: { type: 'string' },
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
                        txSimulationUrl: { type: 'string', nullable: true },
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        }
    }
}

export async function erc20Approve(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC20ApproveRequestParams;
        Body: ERC20ApproveRequestBody;
        Reply: ERC20ApproveResponse;
    }>('/write/erc20/:chainId/:contractAddress/approve', {
        schema: ERC20ApproveSchema
    }, async (request, reply) => {
        logRequest(request);

        let tenderlyUrl: string | null = null;

        try {
            const { spender, amount } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            if (!signer || !signer.account?.address) {
                logError(request, new Error('Signer not configured correctly.'), { signer });
                throw new Error('Signer not configured correctly.');
            }
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            const contract = new ethers.Contract(
                contractAddress,
                erc20Abi,
                signer
            );
            logStep(request, 'Contract instance created', { contractAddress });

            const data = contract.interface.encodeFunctionData(
                'approve',
                [spender, amount]
            );
            logStep(request, 'Function data encoded', { spender, amount });

            const tx = {
                to: contractAddress,
                data
            }

            const {simulationData, signedTx} = await prepareTransactionsForTenderlySimulation(signer, [tx], Number(chainId));
            let tenderlyUrl = getTenderlySimulationUrl({
                chainId: chainId,
                gas: 3000000,
                block: await signer.provider.getBlockNumber(),
                blockIndex: 0,
                contractAddress: signedTx.entrypoint,
                rawFunctionInput: simulationData
            });

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "approve", args: [spender, amount] } });

            logStep(request, 'Sending approve transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'Approve transaction sent', { txHash: txResponse.hash });

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);
            logStep(request, 'Transaction status updated in db', { txHash: txResponse.hash });

            return reply.code(200).send({
                result: {
                    txHash: txResponse.hash,
                    txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash),
                    txSimulationUrl: tenderlyUrl ?? null
                }
            });

        } catch (error) {
            logError(request, error, {
                params: request.params,
                body: request.body
            });
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    txSimulationUrl: tenderlyUrl ?? null,
                    error: error instanceof Error ? error.message : 'Failed to execute approve'
                }
            });
        }
    });
}

