import type { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import { erc20Abi } from '~/constants/abis/erc20'
import {
  getTenderlySimulationUrl,
  prepareTransactionsForTenderlySimulation
} from '~/routes/contract/utils/tenderly/getSimulationUrl'
import { TransactionService } from '~/services/transaction.service'
import type { TransactionResponse } from '~/types/general'
import { logError, logRequest, logStep } from '~/utils/loggingUtils'
import { extractTxHashFromErrorReceipt, getBlockExplorerUrl } from '~/utils/other'
import { getSigner } from '~/utils/wallet'

type erc20PermitRequestBody = {
  owner: string, spender: string, value: string, deadline: string, v: string, r: string, s: string,
  waitForReceipt?: boolean
}

type erc20PermitRequestParams = {
  chainId: string
  contractAddress: string
}

type erc20PermitResponse = {
  result?: {
    txHash: string | null
    txUrl: string | null
    txSimulationUrl?: string | null
    error?: string
  }
}

const erc20PermitSchema = {
  tags: ['erc20'],
  body: {
    type: 'object',
    required: ['owner', 'spender', 'value', 'deadline', 'v', 'r', 's'],
    properties: {
      owner: { type: 'string' },
      spender: { type: 'string' },
      value: { type: 'string' },
      deadline: { type: 'string' },
      v: { type: 'string' },
      r: { type: 'string' },
      s: { type: 'string' },
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

export async function erc20Permit(fastify: FastifyInstance) {
  fastify.post<{
    Params: erc20PermitRequestParams
    Body: erc20PermitRequestBody
    Reply: erc20PermitResponse
  }>(
    '/write/erc20/:chainId/:contractAddress/permit',
    { schema: erc20PermitSchema },
    async (request, reply) => {
      logRequest(request)

      let tenderlyUrl: string | null = null
      let txHash: string | null = null
      const { chainId, contractAddress } = request.params

      try {
        const { owner, spender, value, deadline, v, r, s, waitForReceipt } = request.body

        const signer = await getSigner(chainId)
        if (!signer || !signer.account?.address) {
          logError(request, new Error('Signer not configured correctly.'), { signer })
          throw new Error('Signer not configured correctly.')
        }
        logStep(request, 'Tx signer received', { signer: signer.account.address })

        const contract = new ethers.Contract(contractAddress, erc20Abi, signer)
        logStep(request, 'Contract instance created')

        const encodedData = contract.interface.encodeFunctionData('permit', [
          owner, spender, BigInt(value), BigInt(deadline), BigInt(v), r, s
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

        logStep(request, 'Sending permit transaction...')
        const txResponse: TransactionResponse = await signer.sendTransaction(
          tx,
          { waitForReceipt: waitForReceipt ?? false }
        )
        txHash = txResponse.hash
        logStep(request, 'Permit transaction sent', { txHash: txResponse.hash })

        if (txResponse.receipt?.status === 0) {
          throw new Error('Transaction reverted', { cause: txResponse.receipt })
        }

        await txService.createTransaction({
          chainId,
          contractAddress,
          abi: erc20Abi,
          data: encodedData,
          txHash: txHash,
          isDeployTx: false,
          args: [owner, spender, String(value), String(deadline), String(v), r, s],
          functionName: 'permit'
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