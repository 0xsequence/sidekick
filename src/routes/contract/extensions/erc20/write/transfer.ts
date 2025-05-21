import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc20Abi } from "abitype/abis";
import { TransactionService } from "../../../../../services/transaction.service";
import { logRequest, logStep, logError } from '../../../../../utils/loggingUtils';

type ERC20TransferRequestBody = {
    to: string;
    amount: string;
}

type ERC20TransferRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC20TransferResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC20TransferSchema = {
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

export async function erc20Transfer(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC20TransferRequestParams;
        Body: ERC20TransferRequestBody;
        Reply: ERC20TransferResponse;
    }>('/write/erc20/:chainId/:contractAddress/transfer', {
        schema: ERC20TransferSchema
    }, async (request, reply) => {
        logRequest(request);
        try {
            const { to, amount } = request.body;
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
                'transfer',
                [to, amount]
            );
            logStep(request, 'Function data encoded', { to, amount });

            const tx = {
                to: contractAddress,
                data
            }

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "transfer", args: [to, amount] } });
            logStep(request, 'Pending transaction created', { pendingTx });

            logStep(request, 'Sending transfer transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'Transfer transaction sent', { txHash: txResponse.hash });

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);
            logStep(request, 'Transaction status updated in db', { txHash: txResponse.hash });

            return reply.code(200).send({
                result: {
                    txHash: txResponse.hash,
                    txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash)
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
                    error: error instanceof Error ? error.message : 'Failed to execute transfer'
                }
            });
        }
    });
}
