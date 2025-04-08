import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData } from "viem";
import { erc721bytecode } from "../../../constants/bytecodes/erc721";
import { erc721Abi } from "../../../constants/abis/erc721";
import { TransactionService } from "../../../services/transaction.service";

type ERC721DeployRequestBody = {
    defaultAdmin: string;
    minter: string;
    name: string;
    symbol: string;
}

type ERC721DeployRequestParams = {
    chainId: string;
}

type ERC721DeployResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC721DeploySchema = {
    tags: ['ERC721', 'Deploy'],
    description: 'Deploy an ERC721 contract by providing the default admin, minter, name and symbol',
    body: {
        type: 'object',
        required: ['defaultAdmin', 'minter', 'name', 'symbol'],
        properties: {
            defaultAdmin: { type: 'string' },
            minter: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
        }
    },
    params: {
        type: 'object',
        required: ['chainId'],
        properties: {
            chainId: { type: 'string' },
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

export async function erc721Deploy(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC721DeployRequestParams;
        Body: ERC721DeployRequestBody;
        Reply: ERC721DeployResponse;
    }>('/deploy/erc721/:chainId', {
        schema: ERC721DeploySchema
    }, async (request, reply) => {
        try {
            const { chainId } = request.params;
            const { defaultAdmin, minter, name, symbol } = request.body;

            const signer = await getSigner(chainId);
            const txService = new TransactionService(fastify);
            
            const data = encodeDeployData({
                abi: erc721Abi,
                bytecode: `0x${erc721bytecode}`,
                args: [defaultAdmin, minter, name, symbol]
            })

            const tx = await signer.sendTransaction({
                data
            })

            const receipt = await tx.wait();

            if(receipt?.status === 0) {
                throw new Error('Transaction reverted');
            }

            await txService.createTransaction({
                chainId,
                contractAddress: receipt?.contractAddress ?? '',
                abi: erc721Abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true
            })

            return reply.code(200).send({
                result: {
                    txHash: receipt?.hash ?? null,
                    txUrl: `https://${chainId}.etherscan.io/tx/${receipt?.hash}`
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
