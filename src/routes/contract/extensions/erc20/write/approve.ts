import { getBlockExplorerUrl } from "../../../../../utils";

import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils";
import { ethers } from "ethers";
import { erc20Abi } from "abitype/abis";
import type { TransactionResponse } from "ethers";

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
        error?: string;
    };
}

export async function erc20Approve(fastify: FastifyInstance) {
    // // Approve Route
    fastify.post<{
        Params: ERC20ApproveRequestParams;
        Body: ERC20ApproveRequestBody;
        Reply: ERC20ApproveResponse;
    }>('/erc20/:chainId/:contractAddress/approve', {
        schema: {
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
            }
        }
    }, async (request, reply) => {
        try {
            const { spender, amount } = request.body;
            const { chainId, contractAddress } = request.params;

            const walletAddress = request.headers['x-wallet-address'];
            if (!walletAddress || typeof walletAddress !== 'string') {
                return reply.code(400).send({
                    result: {
                        txHash: null,
                        txUrl: null,
                        error: 'Missing or invalid wallet address header'
                    }
                });
            }

            const signer = await getSigner(chainId);
            const contract = new ethers.Contract(
                contractAddress,
                erc20Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'approve',
                [spender, amount]
            );

            const tx = {
                to: contractAddress,
                data
            }

            const txResponse: TransactionResponse = await signer.sendTransaction(tx);

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
                    error: error instanceof Error ? error.message : 'Failed to execute approve'
                }
            });
        }
    });
}

