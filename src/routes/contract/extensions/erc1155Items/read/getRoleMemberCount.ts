import type { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import { erc1155ItemsAbi } from '~/constants/abis/erc1155Items'
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

type erc1155ItemsGetRoleMemberCountRequestQuery = {
  role: string
}

type erc1155ItemsGetRoleMemberCountRequestParams = {
  chainId: string
  contractAddress: string
}

type erc1155ItemsGetRoleMemberCountResponse = {
  result?: {
    data: any
    error?: string
  }
}

const erc1155ItemsGetRoleMemberCountSchema = {
  tags: ['erc1155Items'],
  querystring: {
    type: 'object',
    required: ['role'],
    properties: {
      role: { type: 'string' }
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

export async function erc1155ItemsGetRoleMemberCount(fastify: FastifyInstance) {
  fastify.get<{
    Params: erc1155ItemsGetRoleMemberCountRequestParams
    Querystring: erc1155ItemsGetRoleMemberCountRequestQuery
    Reply: erc1155ItemsGetRoleMemberCountResponse
  }>(
    '/read/erc1155Items/:chainId/:contractAddress/getRoleMemberCount',
    { schema: erc1155ItemsGetRoleMemberCountSchema },
    async (request, reply) => {
      const { role } = request.query
      const { chainId, contractAddress } = request.params

      try {
        const signer = await getSigner(chainId)
        if (!signer || !signer.account?.address) {
          throw new Error('Signer not configured correctly.')
        }

        const contract = new ethers.Contract(
          contractAddress,
          erc1155ItemsAbi,
          signer
        )

        const result = await contract.getRoleMemberCount(role)

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