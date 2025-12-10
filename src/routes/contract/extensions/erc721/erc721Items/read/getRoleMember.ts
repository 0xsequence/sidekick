import type { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import erc721ItemsAbi from '~/constants/abis/erc721Items.json'
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

type erc721ItemsGetRoleMemberRequestQuery = {
  role: string, index: string
}

type erc721ItemsGetRoleMemberRequestParams = {
  chainId: string
  contractAddress: string
}

type erc721ItemsGetRoleMemberResponse = {
  result?: {
    data: any
    error?: string
  }
}

const erc721ItemsGetRoleMemberSchema = {
  tags: ['ERC721Items'],
  querystring: {
    type: 'object',
    required: ['role', 'index'],
    properties: {
      role: { type: 'string' },
      index: { type: 'string' }
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

export async function erc721ItemsGetRoleMember(fastify: FastifyInstance) {
  fastify.get<{
    Params: erc721ItemsGetRoleMemberRequestParams
    Querystring: erc721ItemsGetRoleMemberRequestQuery
    Reply: erc721ItemsGetRoleMemberResponse
  }>(
    '/read/erc721Items/:chainId/:contractAddress/getRoleMember',
    { schema: erc721ItemsGetRoleMemberSchema },
    async (request, reply) => {
      const { role, index } = request.query
      const { chainId, contractAddress } = request.params

      try {
        const signer = await getSigner(chainId)
        if (!signer || !signer.account?.address) {
          throw new Error('Signer not configured correctly.')
        }

        const contract = new ethers.Contract(
          contractAddress,
          erc721ItemsAbi,
          signer
        )

        const result = await contract.getRoleMember(role, index)

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