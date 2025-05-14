import type { FastifyInstance } from "fastify";
import { getSigner } from "../../../../../../utils/wallet";
import type { TransactionResponse } from "ethers";
import { ethers } from "ethers";
import { getBlockExplorerUrl } from "../../../../../../utils/other";
import { TransactionService } from "../../../../../../services/transaction.service";
import { erc721ItemsAbi } from "../../../../../../constants/abis/erc721Items";

type ERC721ItemsMintRequestBody = {
  to: string;
  amount: string;
};

type ERC721ItemsMintRequestParams = {
  chainId: string;
  contractAddress: string;
};

type ERC721ItemsMintResponse = {
  result?: {
    txHash: string | null;
    txUrl: string | null;
    error?: string;
  };
};

const ERC721ItemsMintSchema = {
  tags: ['ERC721Items'],
  body: {
    type: 'object',
    required: ['to', 'amount'],
    properties: {
      to: { type: 'string' },
      amount: { type: 'string' }
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
            error: { type: 'string', nullable: true }
          }
        }
      }
    }
  }
};

export async function erc721ItemsMint(fastify: FastifyInstance) {
  fastify.post<{
    Params: ERC721ItemsMintRequestParams;
    Body: ERC721ItemsMintRequestBody;
    Reply: ERC721ItemsMintResponse;
  }>(
    '/write/erc721Items/:chainId/:contractAddress/mint',
    { schema: ERC721ItemsMintSchema },
    async (request, reply) => {
      try {
        const { to, amount } = request.body;
        const { chainId, contractAddress } = request.params;

        const signer = await getSigner(chainId);
        const contract = new ethers.Contract(
          contractAddress,
          erc721ItemsAbi,
          signer
        );

        const data = contract.interface.encodeFunctionData(
          'mint',
          [to, amount]
        );

        const tx = {
          to: contractAddress,
          data
        };

        const txService = new TransactionService(fastify);

        // Create pending transaction first
        const pendingTx = await txService.createPendingTransaction({
          chainId,
          contractAddress,
          data: { functionName: 'mint', args: [to, amount] }
        });

        const txResponse: TransactionResponse = await signer.sendTransaction(tx);

        // Update transaction status
        await txService.updateTransactionStatus(pendingTx.id, txResponse);

        return reply.code(200).send({
          result: {
            txHash: txResponse.hash,
            txUrl: getBlockExplorerUrl(Number(chainId), txResponse.hash)
          }
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          result: {
            txHash: null,
            txUrl: null,
            error: error instanceof Error ? error.message : 'Failed to mint ERC721Items'
          }
        });
      }
    }
  );
}
