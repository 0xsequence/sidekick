import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc20Abi } from "abitype/abis";
import { TransactionService } from "../../../../../services/transaction.service";
import { logRequest, logStep } from "../../../../../utils/loggingUtils";
import { getTenderlySimulationUrl, prepareTransactionsForTenderlySimulation } from "../../../utils/tenderly/getSimulationUrl";

type ERC20TransferFromRequestBody = {
    from: string;
    to: string;
    amount: string;
}

type ERC20TransferFromRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC20TransferFromResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        txSimulationUrl?: string | null;
        error?: string;
    };
}

const ERC20TransferFromSchema = {
    tags: ['ERC20'],
    body: {
        type: 'object',
        required: ['from', 'to', 'amount'],
        properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            amount: { type: 'string' }
        }
    },
    params: {
        type: 'object',
        required: ['chainId', 'contractAddress'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' },
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

export async function erc20TransferFrom(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC20TransferFromRequestParams;
        Body: ERC20TransferFromRequestBody;
        Reply: ERC20TransferFromResponse;
    }>('/write/erc20/:chainId/:contractAddress/transferFrom', {
        schema: ERC20TransferFromSchema
    }, async (request, reply) => {
        let tenderlyUrl: string | null = null;

        try {
            logRequest(request);

            const { from, to, amount } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            const contract = new ethers.Contract(
                contractAddress,
                erc20Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'transferFrom',
                [from, to, amount]
            );

            const tx = {
                to: contractAddress,
                data
            }
            logStep(request, 'Tx prepared', { tx });

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
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "transferFrom", args: [from, to, amount] } });
            logStep(request, 'Pending transaction created', { pendingTx });

            logStep(request, 'Sending transferFrom transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'TransferFrom transaction sent', { txHash: txResponse.hash });

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);
            logStep(request, 'Transaction status updated in db', { txHash: txResponse.hash });

            logStep(request, 'TransferFrom transaction success', { txHash: txResponse.hash });
            return reply.code(200).send({
                result: {
                    txHash: txResponse.hash,
                    txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash),
                    txSimulationUrl: tenderlyUrl ?? null
                }
            });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                result: {
                    txHash: null,
                    txUrl: null,
                    txSimulationUrl: tenderlyUrl ?? null,
                    error: error instanceof Error ? error.message : 'Failed to execute transfer'
                }
            });
        }
    });
}
