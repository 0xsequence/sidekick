import type { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import { erc1155Abi } from '~/constants/abis/erc1155'
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

type erc1155SupportsInterfaceRequestQuery = {
  interfaceId: string
}

type erc1155SupportsInterfaceRequestParams = {
  chainId: string
  contractAddress: string
}

type erc1155SupportsInterfaceResponse = {
  result?: {
    data: any
    error?: string
  }
}

const erc1155SupportsInterfaceSchema = {
  tags: ['erc1155'],
  querystring: {
    type: 'object',
    required: ['interfaceId'],
    properties: {
      interfaceId: { type: 'string' }
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

export async function erc1155SupportsInterface(fastify: FastifyInstance) {
  fastify.get<{
    Params: erc1155SupportsInterfaceRequestParams
    Querystring: erc1155SupportsInterfaceRequestQuery
    Reply: erc1155SupportsInterfaceResponse
  }>(
    '/read/erc1155/:chainId/:contractAddress/supportsInterface',
    { schema: erc1155SupportsInterfaceSchema },
    async (request, reply) => {
      const { interfaceId } = request.query
      const { chainId, contractAddress } = request.params

      try {
        const signer = await getSigner(chainId)
        if (!signer || !signer.account?.address) {
          throw new Error('Signer not configured correctly.')
        }

        const contract = new ethers.Contract(
          contractAddress,
          erc1155Abi,
          signer
        )

        const result = await contract.supportsInterface(interfaceId)

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