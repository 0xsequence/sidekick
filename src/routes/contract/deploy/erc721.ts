import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { encodeDeployData } from "viem";
import { erc721bytecode } from "../../../constants/bytecodes/erc721";
import { erc721Abi } from "../../../constants/abis/erc721";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl, getContractAddressFromEvent } from "../../../utils/other";
import { logRequest, logStep, logError } from '../../../utils/loggingUtils';

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
        deployedContractAddress: string | null;
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
                        deployedContractAddress: { type: 'string' },
                        error: { type: 'string', nullable: true }
                    }
                }
            }
        },
        500: {
            type: 'object',
            properties: {
                result: { type: 'object', properties: { error: { type: 'string' } } }
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
            logRequest(request);

            const { chainId } = request.params;
            const { defaultAdmin, minter, name, symbol } = request.body;

            logStep(request, 'Getting tx signer', { chainId });
            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            logStep(request, 'Preparing deploy data', {
                abi: erc721Abi,
                bytecode: erc721bytecode,
                args: [defaultAdmin, minter, name, symbol]
            });
            const data = encodeDeployData({
                abi: erc721Abi,
                bytecode: erc721bytecode as `0x${string}`,
                args: [defaultAdmin, minter, name, symbol]
            });

            logStep(request, 'Sending deploy transaction', { data });
            const tx = await signer.sendTransaction({
                data
            });
            logStep(request, 'Deploy transaction sent', { tx });

            logStep(request, 'Waiting for deploy receipt', { txHash: tx.hash });
            const receipt = await tx.wait();
            logStep(request, 'Deploy receipt received', { receipt });

            const deployedContractAddress = getContractAddressFromEvent(receipt, 'CreatedContract(address)');

            if(receipt?.status === 0) {
                logError(request, new Error('Transaction reverted'), { receipt });
                throw new Error('Transaction reverted');
            }

            logStep(request, 'Creating transaction record in db', {
                chainId,
                contractAddress: receipt?.contractAddress ?? '',
                abi: erc721Abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true
            });
            const txService = new TransactionService(fastify);
            await txService.createTransaction({
                chainId,
                contractAddress: deployedContractAddress,
                abi: erc721Abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true
            });

            logStep(request, 'Deploy transaction success', { txHash: receipt?.hash });
            return reply.code(200).send({
                result: {
                    txHash: receipt?.hash ?? null,
                    txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
                    deployedContractAddress: deployedContractAddress
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
                    deployedContractAddress: null,
                    error: error instanceof Error ? error.message : 'Failed to deploy ERC721'
                }
            });
        }
    });
}
