import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { erc1155Abi } from "../../../constants/abis/erc1155";
import { encodeDeployData } from "viem";
import { erc1155bytecode } from "../../../constants/bytecodes/erc1155";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl } from "../../../utils/other";

type ERC1155DeployRequestBody = {
    defaultAdmin: string;
    minter: string;
    name: string;
}

type ERC1155DeployRequestParams = {
    chainId: string;
}

type ERC1155DeployResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC1155DeploySchema = {
    tags: ['ERC1155', 'Deploy'],
    description: 'Deploy an ERC1155 contract by providing the default admin, minter and name',
    body: {
        type: 'object',
        required: ['defaultAdmin', 'minter', 'name'],
        properties: {
            defaultAdmin: { type: 'string' },
                minter: { type: 'string' },
            name: { type: 'string' },
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

export async function erc1155Deploy(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC1155DeployRequestParams;
        Body: ERC1155DeployRequestBody;
        Reply: ERC1155DeployResponse;
    }>('/deploy/erc1155/:chainId', {
        schema: ERC1155DeploySchema
    }, async (request, reply) => {
        try {
            const { chainId } = request.params;
            const { defaultAdmin, minter, name } = request.body;

            const signer = await getSigner(chainId);
            const txService = new TransactionService(fastify);

            const data = encodeDeployData({
                abi: erc1155Abi,
                bytecode: erc1155bytecode as `0x${string}`,
                args: [defaultAdmin, minter, name]
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
                abi: erc1155Abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true
            })

            return reply.code(200).send({
                result: {
                    txHash: receipt?.hash ?? null,
                    txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? '')
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
