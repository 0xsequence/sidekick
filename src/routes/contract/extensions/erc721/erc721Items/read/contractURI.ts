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

type erc721ItemsContractURIRequestParams = {
  chainId: string
  contractAddress: string
}

type erc721ItemsContractURIResponse = {
  result?: {
    data: any
    error?: string
  }
}

const erc721ItemsContractURISchema = {
  tags: ['ERC721Items'],
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

export async function erc721ItemsContractURI(fastify: FastifyInstance) {
  fastify.get<{
    Params: erc721ItemsContractURIRequestParams
    
    Reply: erc721ItemsContractURIResponse
  }>(
    '/read/erc721Items/:chainId/:contractAddress/contractURI',
    { schema: erc721ItemsContractURISchema },
    async (request, reply) => {
      
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

        const result = await contract.contractURI()

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