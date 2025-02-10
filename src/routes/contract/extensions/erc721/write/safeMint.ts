import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../utils";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from '../../../../../utils';
import { erc721Abi } from "../../../../../constants/abis/erc721";

type ERC721SafeMintRequestBody = {
    to: string;
    tokenId: string;
}

type ERC721SafeMintRequestParams = {
    chainId: string;
    contractAddress: string;
}

type ERC721SafeMintResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

export async function erc721SafeMint(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721SafeMintRequestParams;
        Body: ERC721SafeMintRequestBody;
        Reply: ERC721SafeMintResponse;
    }>('/erc721/:chainId/:contractAddress/safeMint', {
        schema: {
            body: {
                type: 'object',
                required: ['to', 'tokenId'],
                properties: {
                    to: { type: 'string' },
                    tokenId: { type: 'string' }
                }
            },
            params: {
                type: 'object',
                required: ['chainId', 'contractAddress'],
                properties: {
                    chainId: { type: 'string' },
                    contractAddress: { type: 'string' },
                    functionName: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { to, tokenId } = request.body;
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
                erc721Abi,
                signer
            );

            const data = contract.interface.encodeFunctionData(
                'safeMint',
                [to, tokenId]
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
                    error: error instanceof Error ? error.message : 'Failed to mint NFT'
                }
            });
        }
    });
}
