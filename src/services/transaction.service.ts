import type { FastifyInstance } from "fastify";
import type { TransactionResponse } from "ethers";
import { getSigner } from "../utils/wallet";

export class TransactionService {
    constructor(private fastify: FastifyInstance) {}

    async createPendingTransaction(params: {
        chainId: string;
        contractAddress: string;
        data: {
            functionName: string;
            args: any[];
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
                args: params.data.args.map(arg => arg.toString()),
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