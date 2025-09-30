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

type erc721TotalSupplyRequestParams = {
  chainId: string
  contractAddress: string
}

type erc721TotalSupplyResponse = {
  result?: {
    data: any
    error?: string
  }
}

const erc721TotalSupplySchema = {
  tags: ['erc721'],
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

export async function erc721TotalSupply(fastify: FastifyInstance) {
  fastify.get<{
    Params: erc721TotalSupplyRequestParams
    
    Reply: erc721TotalSupplyResponse
  }>(
    '/read/erc721/:chainId/:contractAddress/totalSupply',
    { schema: erc721TotalSupplySchema },
    async (request, reply) => {
      
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

        const result = await contract.totalSupply()

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