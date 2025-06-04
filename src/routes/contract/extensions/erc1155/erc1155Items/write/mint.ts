import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { TransactionService } from "../../../../../../services/transaction.service";
import { erc1155ItemsAbi } from "../../../../../../constants/abis/erc1155Items";
import { getTenderlySimulationUrl, prepareTransactionsForTenderlySimulation } from "../../../../utils/tenderly/getSimulationUrl";

type ERC1155ItemsMintRequestBody = {
  to: string;
  tokenId: string;
  amount: string;
  data?: string;
};

type ERC1155ItemsMintRequestParams = {
  chainId: string;
  contractAddress: string;
};

type ERC1155ItemsMintResponse = {
  result?: {
    txHash: string | null;
    txUrl: string | null;
    txSimulationUrl?: string | null;
    error?: string;
  };
};

const ERC1155ItemsMintSchema = {
  tags: ['ERC1155Items'],
  body: {
    type: 'object',
    required: ['to', 'tokenId', 'amount'],
    properties: {
      to: { type: 'string' },
      tokenId: { type: 'string' },
      amount: { type: 'string' },
      data: { type: 'string', nullable: true }
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

export async function erc1155ItemsMint(fastify: FastifyInstance) {
  fastify.post<{
    Params: ERC1155ItemsMintRequestParams;
    Body: ERC1155ItemsMintRequestBody;
    Reply: ERC1155ItemsMintResponse;
  }>(
    '/write/erc1155Items/:chainId/:contractAddress/mint',
    { schema: ERC1155ItemsMintSchema },
    async (request, reply) => {
      let tenderlyUrl: string | null = null;
      try {
        const { to, tokenId, amount, data } = request.body;
        const { chainId, contractAddress } = request.params;

        const signer = await getSigner(chainId);
        const contract = new ethers.Contract(
          contractAddress,
          erc1155ItemsAbi,
          signer
        );

        const callData = contract.interface.encodeFunctionData(
          'mint',
          [to, tokenId, amount, data ?? "0x"]
        );

        const tx = {
          to: contractAddress,
          data: callData
        };
        
        const {simulationData, signedTx} = await prepareTransactionsForTenderlySimulation(signer, [tx], Number(chainId));
        let tenderlyUrl = getTenderlySimulationUrl({
          chainId: chainId,
          gas: 3000000,
          block: await signer.provider.getBlockNumber(),
          contractAddress: signedTx.entrypoint,
          blockIndex: 0,
          rawFunctionInput: simulationData
        });

        const txService = new TransactionService(fastify);

        // Create pending transaction first
        const pendingTx = await txService.createPendingTransaction({
          chainId,
          contractAddress,
          data: { functionName: 'mint', args: [to, tokenId, amount, data ?? "0x"] }
        });

        const txResponse: TransactionResponse = await signer.sendTransaction(tx);

        // Update transaction status
        await txService.updateTransactionStatus(pendingTx.id, txResponse);

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
            error: error instanceof Error ? error.message : 'Failed to mint ERC1155Items'
          }
        });
      }
    }
  );
}
