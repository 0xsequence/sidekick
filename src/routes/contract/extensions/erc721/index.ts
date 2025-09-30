import type { FastifyInstance } from 'fastify'

import { erc721Approve } from './write/approve'
import { erc721SafeTransferFrom_1 } from './write/safeTransferFrom_1'
import { erc721SafeTransferFrom_2 } from './write/safeTransferFrom_2'
import { erc721SetApprovalForAll } from './write/setApprovalForAll'
import { erc721TransferFrom } from './write/transferFrom'
import { erc721TotalSupply } from './read/totalSupply'
import { erc721BalanceOf } from './read/balanceOf'
import { erc721GetApproved } from './read/getApproved'
import { erc721IsApprovedForAll } from './read/isApprovedForAll'
import { erc721Name } from './read/name'
import { erc721OwnerOf } from './read/ownerOf'
import { erc721SupportsInterface } from './read/supportsInterface'
import { erc721Symbol } from './read/symbol'
import { erc721TokenURI } from './read/tokenURI'

export function registerErc721Routes(fastify: FastifyInstance) {
  erc721Approve(fastify)
  erc721SafeTransferFrom_1(fastify)
  erc721SafeTransferFrom_2(fastify)
  erc721SetApprovalForAll(fastify)
  erc721TransferFrom(fastify)
  erc721TotalSupply(fastify)
  erc721BalanceOf(fastify)
  erc721GetApproved(fastify)
  erc721IsApprovedForAll(fastify)
  erc721Name(fastify)
  erc721OwnerOf(fastify)
  erc721SupportsInterface(fastify)
  erc721Symbol(fastify)
  erc721TokenURI(fastify)
}