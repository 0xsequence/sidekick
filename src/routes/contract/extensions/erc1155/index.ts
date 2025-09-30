import type { FastifyInstance } from 'fastify'

import { erc1155SafeBatchTransferFrom } from './write/safeBatchTransferFrom'
import { erc1155SafeTransferFrom } from './write/safeTransferFrom'
import { erc1155SetApprovalForAll } from './write/setApprovalForAll'
import { erc1155BalanceOf } from './read/balanceOf'
import { erc1155BalanceOfBatch } from './read/balanceOfBatch'
import { erc1155IsApprovedForAll } from './read/isApprovedForAll'
import { erc1155SupportsInterface } from './read/supportsInterface'
import { erc1155Uri } from './read/uri'

export function registerErc1155Routes(fastify: FastifyInstance) {
  erc1155SafeBatchTransferFrom(fastify)
  erc1155SafeTransferFrom(fastify)
  erc1155SetApprovalForAll(fastify)
  erc1155BalanceOf(fastify)
  erc1155BalanceOfBatch(fastify)
  erc1155IsApprovedForAll(fastify)
  erc1155SupportsInterface(fastify)
  erc1155Uri(fastify)
}