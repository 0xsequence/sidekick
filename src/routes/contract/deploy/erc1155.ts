import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../utils/wallet";
import { erc1155Abi } from "../../../constants/abis/erc1155";
import { encodeAbiParameters, encodeDeployData } from "viem";
import { erc1155bytecode } from "../../../constants/bytecodes/erc1155";
import { TransactionService } from "../../../services/transaction.service";
import { getBlockExplorerUrl, getContractAddressFromEvent } from "../../../utils/other";
import { logRequest, logStep, logError } from '../../../utils/loggingUtils';
import { verifyContract } from "../../../utils/contractVerification";
import { erc1155JsonInputMetadata } from "../../../constants/contractJsonInputs/erc1155";
import { getTenderlySimulationUrl, prepareTransactionsForTenderlySimulation } from "../utils/tenderly/getSimulationUrl";

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
        deployedContractAddress: string | null;
        txSimulationUrl?: string | null;
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
                        deployedContractAddress: { type: 'string' },
                        txSimulationUrl: { type: 'string', nullable: true },
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
        let tenderlyUrl: string | null = null;
        try {
            logRequest(request);

            const { chainId } = request.params;
            const { defaultAdmin, minter, name } = request.body;

            logStep(request, 'Getting tx signer', { chainId });
            const signer = await getSigner(chainId);
            logStep(request, 'Tx signer received', { signer: signer.account.address });

            logStep(request, 'Preparing deploy data', {
                abi: erc1155Abi,
                bytecode: erc1155bytecode,
                args: [defaultAdmin, minter, name]
            });
            const data = encodeDeployData({
                abi: erc1155Abi,
                bytecode: erc1155bytecode as `0x${string}`,
                args: [defaultAdmin, minter, name]
            });
            logStep(request, 'Deploy data prepared');

            logStep(request, 'Sending deploy transaction');
            const tx = await signer.sendTransaction({
                data
            });
            logStep(request, 'Deploy transaction sent', { tx });

            const {simulationData, signedTx} = await prepareTransactionsForTenderlySimulation(signer, [tx], Number(chainId));
            let tenderlyUrl = getTenderlySimulationUrl({
                chainId: chainId,
                gas: 3000000,
                block: await signer.provider.getBlockNumber(),
                contractAddress: signedTx.entrypoint,
                blockIndex: 0,
                rawFunctionInput: simulationData
            });

            logStep(request, 'Waiting for deploy receipt', { txHash: tx.hash });
            const receipt = await tx.wait();
            logStep(request, 'Deploy receipt received', { receipt });

            const deployedContractAddress = getContractAddressFromEvent(receipt, 'CreatedContract(address)');

            if(receipt?.status === 0) {
                logError(request, new Error('Transaction reverted'), { receipt });
                throw new Error('Transaction reverted');
            }

            logStep(request, 'Creating transaction record in db');
            const txService = new TransactionService(fastify);
            await txService.createTransaction({
                chainId,
                contractAddress: deployedContractAddress,
                abi: erc1155Abi,
                data,
                txHash: receipt?.hash ?? '',
                isDeployTx: true
            });

            logStep(request, 'Deploy transaction success', { txHash: receipt?.hash });

            // --- Verification logic (added) ---
            if (process.env.VERIFY_CONTRACT_ON_DEPLOY === 'true') {
                logStep(request, 'Verifying contract', {
                    chainId,
                    contractAddress: deployedContractAddress,
                    contractName: 'ERC721',
                });

                const encodedConstructorArguments = encodeAbiParameters(
                    [
                        { name: 'defaultAdmin', type: 'address' },
                        { name: 'minter', type: 'address' },
                        { name: 'name', type: 'string' },
                    ],
                    [defaultAdmin as `0x${string}`, minter as `0x${string}`, name]
                );

                // Remove "0x" prefix if present
                const encodedArgsNoPrefix = encodedConstructorArguments.startsWith('0x')
                    ? encodedConstructorArguments.slice(2)
                    : encodedConstructorArguments;

                const response = await verifyContract({
                    chainId,
                    contractAddress: deployedContractAddress,
                    contractName: "contracts/ERC721.sol:NFT",
                    compilerVersion: 'v0.8.27+commit.40a35a09',
                    contractInputMetadata: erc1155JsonInputMetadata,
                    constructorArguments: encodedArgsNoPrefix
                });

                logStep(request, 'Contract verification response: ', { response });
            }
            // --- End verification logic ---

            return reply.code(200).send({
                result: {
                    txHash: receipt?.hash ?? null,
                    txUrl: getBlockExplorerUrl(Number(chainId), receipt?.hash ?? ''),
                    txSimulationUrl: tenderlyUrl,
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
                    txSimulationUrl: tenderlyUrl,
                    deployedContractAddress: null,
                    error: error instanceof Error ? error.message : 'Failed to deploy ERC1155'
                }
            });
        }
    });
}
