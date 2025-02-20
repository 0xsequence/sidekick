import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils/other';
import { erc721Abi } from "../../../../../constants/abis/erc721";
import { TransactionService } from "../../../../../services/transaction.service";
import { erc1155Abi } from "../../../../../constants/abis/erc1155";

type ERC1155MintBatchRequestBody = {
    accounts: string[];
    ids: string[];
    amounts: string[];
    datas: string[];
}

type ERC1155MintBatchRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC1155MintBatchResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC1155MintBatchSchema = {
    body: {
        type: 'object',
        required: ['accounts', 'ids', 'amounts', 'datas'],
        properties: {
            accounts: { type: 'array', items: { type: 'string' } },
            ids: { type: 'array', items: { type: 'string' } },
            amounts: { type: 'array', items: { type: 'string' } },
            datas: { type: 'array', items: { type: 'string' } }
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

export async function erc1155MintBatch(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC1155MintBatchRequestParams;
        Body: ERC1155MintBatchRequestBody;
        Reply: ERC1155MintBatchResponse;
    }>('/write/erc1155/:chainId/:contractAddress/mintBatch', {
        schema: ERC1155MintBatchSchema
    }, async (request, reply) => {
        try {
            const { accounts, ids, amounts, datas } = request.body;
            const { chainId, contractAddress } = request.params;

            const signer = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc1155Abi,
                signer
            );

            const txs = accounts.map((account: string, index: number) => {
                const data = contract.interface.encodeFunctionData(
                    'mint',
                    [account, ids[index], amounts[index], datas[index]]
                );
                return {
                    to: contractAddress,
                    data
                }
            })

            const txService = new TransactionService(fastify);

            // Create pending transaction first
            const pendingTx = await txService.createPendingTransaction({ chainId, contractAddress, data: { functionName: "mint (batch)", args: [accounts, ids, amounts, datas] } });

            const txResponse: TransactionResponse = await signer.sendTransaction(txs);

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
