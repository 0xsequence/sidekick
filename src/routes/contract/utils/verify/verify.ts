import type { FastifyInstance } from "fastify";
import { verifyContract as verifyContractStandardJsonInput } from "../../../../utils/contractVerification";
import { type ContractInputMetadata } from "../../../../types/contract";

// Types for request and response
// (You may want to move these to a shared types file if reused)
type VerifyContractRequestBody = {
    chainId: string;
    contractAddress: string;
    compilerVersion: string;
    contractInputMetadata: ContractInputMetadata;
    contractName: string;
    constructorArguments?: string;
    isOptimizationUsed?: boolean;
};

type VerifyContractResponse = {
    result?: unknown;
    error?: string;
};

const verifyContractSchema = {
    tags: ['Contract', 'Verify'],
    description: 'Verify a contract using standard JSON input metadata',
    body: {
        type: 'object',
        required: ['chainId', 'contractAddress', 'compilerVersion', 'contractInputMetadata', 'contractName'],
        properties: {
            chainId: { type: 'string' },
            contractAddress: { type: 'string' },
            compilerVersion: { type: 'string' },
            contractInputMetadata: { type: 'object' },
            contractName: { type: 'string' },
            constructorArguments: { type: 'string', nullable: true },
            isOptimizationUsed: { type: 'boolean', nullable: true }
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
                result: { type: 'object' }
            }
        },
        500: {
            type: 'object',
            properties: {
                error: { type: 'string' }
            }
        }
    }
};

export async function verifyContract(fastify: FastifyInstance) {
    fastify.post<{
        Body: VerifyContractRequestBody;
        Reply: VerifyContractResponse;
    }>('/contract/verify/standard-json-input', {
        schema: verifyContractSchema
    }, async (request, reply) => {

        if(!process.env.ETHERSCAN_API_KEY) {
            return reply.code(500).send({
                error: 'ETHERSCAN_API_KEY is not set'
            });
        }

        try {
            const {
                chainId,
                contractAddress,
                compilerVersion,
                contractInputMetadata,
                constructorArguments,
                contractName,
                isOptimizationUsed
            } = request.body;

            const result = await verifyContractStandardJsonInput({
                chainId,
                contractAddress,
                contractName,
                compilerVersion,
                contractInputMetadata,
                constructorArguments,
                isOptimizationUsed
            });

            return reply.code(200).send({ result });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                error: error instanceof Error ? error.message : 'Failed to verify contract'
            });
        }
    });
}
