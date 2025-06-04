import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { TransactionService } from "../../../../../../services/transaction.service";
import { erc1155ItemsAbi } from "../../../../../../constants/abis/erc1155Items";
import { logRequest, logStep } from "../../../../../../utils/loggingUtils";
import { getTenderlySimulationUrl, prepareTransactionsForTenderlySimulation } from "../../../../utils/tenderly/getSimulationUrl";

type ERC1155ItemsBatchBurnRequestBody = {
  tokenIds: string[];
  amounts: string[];
};

type ERC1155ItemsBatchBurnRequestParams = {
  chainId: string;
  contractAddress: string;
};

type ERC1155ItemsBatchBurnResponse = {
  result?: {
    txHash: string | null;
    txUrl: string | null;
    txSimulationUrl?: string | null;
    error?: string;
  };
};

const ERC1155ItemsBatchBurnSchema = {
  tags: ['ERC1155Items'],
  body: {
    type: 'object',
    required: ['tokenIds', 'amounts'],
    properties: {
      tokenIds: { type: 'array', items: { type: 'string' } },
      amounts: { type: 'array', items: { type: 'string' } }
    }
  },
  params: {
    type: 'object',
    required: ['chainId', 'contractAddress'],
    properties: {
      chainId: { type: 'string' },
      contractAddress: { type: 'string' },
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
            txSimulationUrl: { type: 'string', nullable: true },
            error: { type: 'string', nullable: true }
          }
        }
      }
    }
  }
};

export async function erc1155ItemsBatchBurn(fastify: FastifyInstance) {
  fastify.post<{
    Params: ERC1155ItemsBatchBurnRequestParams;
    Body: ERC1155ItemsBatchBurnRequestBody;
    Reply: ERC1155ItemsBatchBurnResponse;
  }>(
    '/write/erc1155Items/:chainId/:contractAddress/batchBurn',
    { schema: ERC1155ItemsBatchBurnSchema },
    async (request, reply) => {
      let tenderlyUrl: string | null = null;
      try {
        logRequest(request);
        
        const { tokenIds, amounts } = request.body;
        const { chainId, contractAddress } = request.params;

        const signer = await getSigner(chainId);
        logStep(request, 'Tx signer received', { signer: signer.account.address });

        const contract = new ethers.Contract(
          contractAddress,
          erc1155ItemsAbi,
          signer
        );

        // Convert string arrays to BigInt arrays for the contract call
        const tokenIdsBigInt = tokenIds.map(id => BigInt(id));
        const amountsBigInt = amounts.map(a => BigInt(a));

        const callData = contract.interface.encodeFunctionData(
          'batchBurn',
          [tokenIdsBigInt, amountsBigInt]
        );

        const tx = {
          to: contractAddress,
          data: callData
        };
        logStep(request, 'Tx prepared', { tx });

        const {simulationData, signedTx} = await prepareTransactionsForTenderlySimulation(signer, [tx], Number(chainId));
        let tenderlyUrl = getTenderlySimulationUrl({
          chainId: chainId,
          gas: 3000000,
          block: await signer.provider.getBlockNumber(),
          blockIndex: 0,
          contractAddress: signedTx.entrypoint,
          rawFunctionInput: simulationData
        });

        const txService = new TransactionService(fastify);

        // Create pending transaction first
        const pendingTx = await txService.createPendingTransaction({
          chainId,
          contractAddress,
          data: { functionName: 'batchBurn', args: [JSON.stringify(tokenIds), JSON.stringify(amounts)] }
        });
        logStep(request, 'Added pending transaction in db');

        logStep(request, 'Sending batchBurn transaction...');
        const txResponse: TransactionResponse = await signer.sendTransaction(tx);
        logStep(request, 'BatchBurn transaction sent', { txResponse });

        // Update transaction status
        await txService.updateTransactionStatus(pendingTx.id, txResponse);
        logStep(request, 'Transaction status updated in db', { txResponse });

        logStep(request, 'Batch burn transaction success', { txHash: txResponse.hash });
        return reply.code(200).send({
          result: {
            txHash: txResponse.hash,
            txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash),
            txSimulationUrl: tenderlyUrl ?? null
          }
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          result: {
            txHash: null,
            txUrl: null,
            txSimulationUrl: tenderlyUrl ?? null,
            error: error instanceof Error ? error.message : 'Failed to batchBurn ERC1155Items'
          }
        });
      }
    }
  );
} 