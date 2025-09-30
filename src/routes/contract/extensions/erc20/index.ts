import type { FastifyInstance } from 'fastify'

import { erc20Approve } from './write/approve'
import { erc20Burn } from './write/burn'
import { erc20BurnFrom } from './write/burnFrom'
import { erc20Mint } from './write/mint'
import { erc20Permit } from './write/permit'
import { erc20RenounceOwnership } from './write/renounceOwnership'
import { erc20Transfer } from './write/transfer'
import { erc20TransferFrom } from './write/transferFrom'
import { erc20TransferOwnership } from './write/transferOwnership'
import { erc20DOMAIN_SEPARATOR } from './read/DOMAIN_SEPARATOR'
import { erc20Allowance } from './read/allowance'
import { erc20BalanceOf } from './read/balanceOf'
import { erc20Decimals } from './read/decimals'
import { erc20Eip712Domain } from './read/eip712Domain'
import { erc20Name } from './read/name'
import { erc20Nonces } from './read/nonces'
import { erc20Owner } from './read/owner'
import { erc20Symbol } from './read/symbol'
import { erc20TotalSupply } from './read/totalSupply'

export function registerErc20Routes(fastify: FastifyInstance) {
  erc20Approve(fastify)
  erc20Burn(fastify)
  erc20BurnFrom(fastify)
  erc20Mint(fastify)
  erc20Permit(fastify)
  erc20RenounceOwnership(fastify)
  erc20Transfer(fastify)
  erc20TransferFrom(fastify)
  erc20TransferOwnership(fastify)
  erc20DOMAIN_SEPARATOR(fastify)
  erc20Allowance(fastify)
  erc20BalanceOf(fastify)
  erc20Decimals(fastify)
  erc20Eip712Domain(fastify)
  erc20Name(fastify)
  erc20Nonces(fastify)
  erc20Owner(fastify)
  erc20Symbol(fastify)
  erc20TotalSupply(fastify)
}