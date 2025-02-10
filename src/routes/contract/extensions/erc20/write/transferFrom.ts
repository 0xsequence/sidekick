import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils';
import { erc20Abi } from "abitype/abis";

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
        error?: string;
    };
}

export async function erc20TransferFrom(fastify: FastifyInstance) {
    // Transfer Route
    fastify.post<{
        Params: ERC20TransferFromRequestParams;
        Body: ERC20TransferFromRequestBody;
        Reply: ERC20TransferFromResponse;
    }>('/erc20/:chainId/:contractAddress/transferFrom', {
        schema: {
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
            }
        }
    }, async (request, reply) => {
        try {
            const { from, to, amount } = request.body;
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
                'transferFrom',
                [from, to, amount]
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
                    error: error instanceof Error ? error.message : 'Failed to execute transfer'
                }
            });
        }
    });
}
