import type { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import { erc721Abi } from '~/constants/abis/erc721'
import { getSigner } from '~/utils/wallet'

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  
  return obj;
}

type erc721BalanceOfRequestQuery = {
  owner: string
}

type erc721BalanceOfRequestParams = {
  chainId: string
  contractAddress: string
}

type erc721BalanceOfResponse = {
  result?: {
    data: any
    error?: string
  }
}

const erc721BalanceOfSchema = {
  tags: ['erc721'],
  querystring: {
    type: 'object',
    required: ['owner'],
    properties: {
      owner: { type: 'string' }
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
  response: {
    200: {
      type: 'object',
      properties: {
        result: {
          type: 'object',
          properties: {
            data: {},
            error: { type: 'string', nullable: true }
          }
        }
      }
    }
  }
}

export async function erc721BalanceOf(fastify: FastifyInstance) {
  fastify.get<{
    Params: erc721BalanceOfRequestParams
    Querystring: erc721BalanceOfRequestQuery
    Reply: erc721BalanceOfResponse
  }>(
    '/read/erc721/:chainId/:contractAddress/balanceOf',
    { schema: erc721BalanceOfSchema },
    async (request, reply) => {
      const { owner } = request.query
      const { chainId, contractAddress } = request.params

      try {
        const signer = await getSigner(chainId)
        if (!signer || !signer.account?.address) {
          throw new Error('Signer not configured correctly.')
        }

        const contract = new ethers.Contract(
          contractAddress,
          erc721Abi,
          signer
        )

        const result = await contract.balanceOf(owner)

        return reply.code(200).send({
          result: {
            data: serializeBigInt(result)
          }
        })
      } catch (error) {
        return reply.code(500).send({
          result: {
            data: null,
            error: error instanceof Error ? error.message : 'Read failed'
          }
        })
      }
    }
  )
}