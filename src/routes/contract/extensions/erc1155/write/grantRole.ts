import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { TransactionService } from "../../../../../services/transaction.service";
import { erc1155Abi } from "../../../../../constants/abis/erc1155";

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
                        error: { type: 'string', nullable: true }
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
        try {
            const { role, account } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc1155Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'grantRole',
                [role, account]
            );

            const tx = {
                to: contractAddress,
                data
            }

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "grantRole", args: [role, account] } });

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
                    error: error instanceof Error ? error.message : 'Failed to mint NFT'
                }
            });
        }
    });
}
