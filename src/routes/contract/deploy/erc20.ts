import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData } from "viem";
import { erc20Abi } from "../../../constants/abis/erc20";
import { erc20bytecode } from "../../../constants/bytecodes/erc20";
import { TransactionService } from "../../../services/transaction.service";

type ERC20DeployRequestBody = {
    initialOwner: string;
    name: string;
    symbol: string;
}

type ERC20DeployRequestParams = {
    chainId: string;
}

type ERC20DeployResponse = {
    result?: {
        txHash: string | null;
        txUrl: string | null;
        error?: string;
    };
}

const ERC20DeploySchema = {
    tags: ['ERC20', 'Deploy'],
    description: 'Deploy an ERC20 contract by providing the initial owner, name and symbol',
    body: {
        type: 'object',
        required: ['initialOwner', 'name', 'symbol'],
        properties: {
            initialOwner: { type: 'string' },
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

export async function erc20Deploy(fastify: FastifyInstance) {
    fastify.post<{
        Params: ERC20DeployRequestParams;
        Body: ERC20DeployRequestBody;
        Reply: ERC20DeployResponse;
    }>('/deploy/erc20/:chainId', {
        schema: ERC20DeploySchema
    }, async (request, reply) => {
        try {
            const { chainId } = request.params;
            const { initialOwner, name, symbol } = request.body;

            const signer = await getSigner(chainId);
            const txService = new TransactionService(fastify);

            const data = encodeDeployData({
                abi: erc20Abi,
                bytecode: `0x${erc20bytecode}`,
                args: [initialOwner, name, symbol]
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
                abi: erc20Abi,
                data,
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
