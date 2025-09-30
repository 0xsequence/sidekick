import type { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import { erc20Abi } from '~/constants/abis/erc20'
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

type erc20Eip712DomainRequestParams = {
  chainId: string
  contractAddress: string
}

type erc20Eip712DomainResponse = {
  result?: {
    data: any
    error?: string
  }
}

const erc20Eip712DomainSchema = {
  tags: ['erc20'],
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

export async function erc20Eip712Domain(fastify: FastifyInstance) {
  fastify.get<{
    Params: erc20Eip712DomainRequestParams
    
    Reply: erc20Eip712DomainResponse
  }>(
    '/read/erc20/:chainId/:contractAddress/eip712Domain',
    { schema: erc20Eip712DomainSchema },
    async (request, reply) => {
      
      const { chainId, contractAddress } = request.params

      try {
        const signer = await getSigner(chainId)
        if (!signer || !signer.account?.address) {
          throw new Error('Signer not configured correctly.')
        }

        const contract = new ethers.Contract(
          contractAddress,
          erc20Abi,
          signer
        )

        const result = await contract.eip712Domain()

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