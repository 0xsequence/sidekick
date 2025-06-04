import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { TransactionService } from "../../../../../services/transaction.service";
import { erc1155Abi } from "../../../../../constants/abis/erc1155";
import { logRequest, logStep, logError } from '../../../../../utils/loggingUtils';
import { getTenderlySimulationUrl, prepareTransactionsForTenderlySimulation } from "../../../utils/tenderly/getSimulationUrl";

type ERC1155GrantRoleRequestBody = {
    role: string;
    account: string;
}

type ERC1155GrantRoleRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC1155GrantRoleResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        txSimulationUrl?: string | null;
        error?: string;
    };
}

const ERC1155GrantRoleSchema = {
    tags: ['ERC1155'],
    body: {
        type: 'object',
        required: ['role', 'account'],
        properties: {
            role: { type: 'string' },
            account: { type: 'string' }
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
        },
        500: {
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    properties: {
                        txHash: { type: 'string', nullable: true },
                        txUrl: { type: 'string', nullable: true },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }
}

export async function erc1155GrantRole(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC1155GrantRoleRequestParams;
        Body: ERC1155GrantRoleRequestBody;
        Reply: ERC1155GrantRoleResponse;
    }>('/write/erc1155/:chainId/:contractAddress/grantRole', {
        schema: ERC1155GrantRoleSchema
    }, async (request, reply) => {
        logRequest(request);
        let tenderlyUrl: string | null = null;
        try {
            const { role, account } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            if (!signer || !signer.account?.address) {
                logError(request, new Error('Signer not configured correctly.'), { signer });
                throw new Error('Signer not configured correctly.');
            }
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            const contract = new ethers.Contract(
                contractAddress,
                erc1155Abi,
                signer
            );
            logStep(request, 'Contract instance created');

            const data = contract.interface.encodeFunctionData(
                'grantRole',
                [role, account]
            );
            logStep(request, 'Function data encoded', { role, account });

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
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "grantRole", args: [role, account] } });
            logStep(request, 'Added pending transaction in db');

            logStep(request, 'Sending grantRole transaction...');
            const txResponse: TransactionResponse = await signer.sendTransaction(tx);
            logStep(request, 'grantRole transaction sent', { txResponse });

            // Update transaction status
            await txService.updateTransactionStatus(pendingTx.id, txResponse);
            logStep(request, 'Transaction status updated in db', { txResponse });

            logStep(request, 'Grant role transaction success', { txHash: txResponse.hash });
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
                    error: error instanceof Error ? error.message : 'Failed to mint NFT'
                }
            });
        }
    });
}
