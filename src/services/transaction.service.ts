import type { FastifyInstance } from "fastify";
import type { TransactionResponse } from "ethers";
import { getSigner } from "../utils/wallet";
import { encodeFunctionData } from "viem";

export class TransactionService {
    constructor(private fastify: FastifyInstance) {}

    async createTransaction(params: {
        chainId: string;
        contractAddress: string;
        abi: Array<unknown>;
        data?: string | undefined;
        functionName?: string | undefined;
        args?: Array<string> | undefined;
        isDeployTx?: boolean;
    }) {
        const signer = await getSigner(params.chainId);

        let encodedData: string | undefined;
        if(!params.data) {
            encodedData = encodeFunctionData({
                abi: params.abi,
                functionName: params.functionName ?? '',
                args: params.args ?? [],
            });
        }

        const pendingTx = await this.fastify.prisma.transaction.create({
            data: {
                hash: "",
                chainId: Number(params.chainId),
                from: await signer.getAddress(),
                to: params.contractAddress,
                data: params.data ?? encodedData ?? '',
                status: 'done',
                argsJson: JSON.stringify(params.args),
                functionName: params.functionName ?? '',
                isDeployTx: params.isDeployTx ?? false,
            }
        });

        return pendingTx;
    }

    async createPendingTransaction(params: {
        chainId: string;
        contractAddress: string;
        data: {
            functionName: string;
            args: Array<string>;
        };
    }) {
        const signer = await getSigner(params.chainId);
        
        const pendingTx = await this.fastify.prisma.transaction.create({
            data: {
                hash: "",
                chainId: Number(params.chainId),
                from: await signer.getAddress(),
                to: params.contractAddress,
                data: "",
                status: 'pending',
                argsJson: JSON.stringify(params.data.args),
                functionName: params.data.functionName,
            }
        });
        
        return pendingTx;
    }

    async updateTransactionStatus(
        txId: string,
        txResponse: TransactionResponse,
    ) {
        try {
            const receipt = await txResponse.wait();
            const status = receipt?.status === 1 ? 'done' : 'failed';
            
            await this.fastify.prisma.transaction.update({
                where: { id: txId },
                data: {
                    hash: txResponse.hash,
                    data: txResponse.data,
                    status: status,
                }
            });
            
            return status;
        } catch (error) {
            await this.fastify.prisma.transaction.update({
                where: { id: txId },
                data: {
                    hash: txResponse.hash,
                    data: txResponse.data,
                    status: 'failed',
                }
            });
            throw error;
        }
    }
} 