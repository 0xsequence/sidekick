import type { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import { erc1155ItemsAbi } from '~/constants/abis/erc1155Items'
import {
  getTenderlySimulationUrl,
  prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import type { TransactionResponse } from '~/types/general'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type erc1155ItemsBatchBurnRequestBody = {
  tokenIds: string[], amounts: string[],
  waitForReceipt?: boolean
}

type erc1155ItemsBatchBurnRequestParams = {
  chainId: string
  contractAddress: string
}

type erc1155ItemsBatchBurnResponse = {
  result?: {
    txHash: string | null
    txUrl: string | null
    txSimulationUrl?: string | null
    error?: string
  }
}

const erc1155ItemsBatchBurnSchema = {
  tags: ['erc1155Items'],
  body: {
    type: 'object',
    required: ['tokenIds', 'amounts'],
    properties: {
      tokenIds: { type: 'array', items: { type: 'string' } },
      amounts: { type: 'array', items: { type: 'string' } },
      waitForReceipt: { type: 'boolean', nullable: true }
    }
  },
  params: {
    type: 'object',
    required: ['chainId', 'contractAddress'],
    properties: {
      chainId: { type: 'string' },
      contractAddress: { type: 'string' }
    }
  },
  headers: {
    type: 'object',
    properties: {
      'x-secret-key': { type: 'string', nullable: true }
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
    },
    500: {
      type: 'object',
      properties: {
        result: {
          type: 'object',
          properties: {
            txHash: { type: 'string', nullable: true },
            txUrl: { type: 'string', nullable: true },
            txSimulationUrl: { type: 'string', nullable: true },
            error: { type: 'string' }
          }
        }
      }
    }
  }
}

export async function erc1155ItemsBatchBurn(fastify: FastifyInstance) {
  fastify.post<{
    Params: erc1155ItemsBatchBurnRequestParams
    Body: erc1155ItemsBatchBurnRequestBody
    Reply: erc1155ItemsBatchBurnResponse
  }>(
    '/write/erc1155Items/:chainId/:contractAddress/batchBurn',
    { schema: erc1155ItemsBatchBurnSchema },
    async (request, reply) => {
      logRequest(request)

      let tenderlyUrl: string | null = null
      let txHash: string | null = null
      const { chainId, contractAddress } = request.params

      try {
        const { tokenIds, amounts, waitForReceipt } = request.body

        const signer = await getSigner(chainId)
        if (!signer || !signer.account?.address) {
          logError(request, new Error('Signer not configured correctly.'), { signer })
          throw new Error('Signer not configured correctly.')
        }
        logStep(request, 'Tx signer received', { signer: signer.account.address })

        const contract = new ethers.Contract(contractAddress, erc1155ItemsAbi, signer)
        logStep(request, 'Contract instance created')

        const encodedData = contract.interface.encodeFunctionData('batchBurn', [
          tokenIds.map((v) => BigInt(v)), amounts.map((v) => BigInt(v))
        ])
        logStep(request, 'Function data encoded')

        const tx = { to: contractAddress, data: encodedData }

        const { simulationData, signedTx } = await prepareTransactionsForTenderlySimulation(
          signer,
          [tx],
          Number(chainId)
        )
        tenderlyUrl = getTenderlySimulationUrl({
          chainId: chainId,
          gas: 3000000,
          block: await signer.provider.getBlockNumber(),
          blockIndex: 0,
          contractAddress: signedTx.entrypoint,
          rawFunctionInput: simulationData
        })

        const txService = new TransactionService(fastify)

        logStep(request, 'Sending batchBurn transaction...')
        const txResponse: TransactionResponse = await signer.sendTransaction(
          tx,
          { waitForReceipt: waitForReceipt ?? false }
        )
        txHash = txResponse.hash
        logStep(request, 'BatchBurn transaction sent', { txHash: txResponse.hash })

        if (txResponse.receipt?.status === 0) {
          throw new Error('Transaction reverted', { cause: txResponse.receipt })
        }

        await txService.createTransaction({
          chainId,
          contractAddress,
          abi: erc1155ItemsAbi,
          data: encodedData,
          txHash: txHash,
          isDeployTx: false,
          args: [tokenIds.map(String), amounts.map(String)],
          functionName: 'batchBurn'
        })

        return reply.code(200).send({
          result: {
            txHash: txHash,
            txUrl: getBlockExplorerUrl(Number(chainId), txHash),
            txSimulationUrl: tenderlyUrl ?? null
          }
        })
      } catch (error) {
        const errorTxHash = extractTxHashFromErrorReceipt(error)
        const finalTxHash = txHash ?? errorTxHash

        logError(request, error, { params: request.params, body: request.body, txHash: finalTxHash })

        const errorMessage = error instanceof Error ? error.message : 'Failed to execute transaction'
        return reply.code(500).send({
          result: {
            txHash: finalTxHash,
            txUrl: finalTxHash ? getBlockExplorerUrl(Number(chainId), finalTxHash) : null,
            txSimulationUrl: tenderlyUrl ?? null,
            error: errorMessage
          }
        })
      }
    }
  )
}