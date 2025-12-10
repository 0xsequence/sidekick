import type { FastifyInstance } from 'fastify'

import { erc721ItemsApprove } from './write/approve'
import { erc721ItemsBatchBurn } from './write/batchBurn'
import { erc721ItemsBurn } from './write/burn'
import { erc721ItemsGrantRole } from './write/grantRole'
import { erc721ItemsInitialize } from './write/initialize'
import { erc721ItemsMint } from './write/mint'
import { erc721ItemsMintSequential } from './write/mintSequential'
import { erc721ItemsRenounceRole } from './write/renounceRole'
import { erc721ItemsRevokeRole } from './write/revokeRole'
import { erc721ItemsSafeTransferFrom_1 } from './write/safeTransferFrom_1'
import { erc721ItemsSafeTransferFrom_2 } from './write/safeTransferFrom_2'
import { erc721ItemsSetApprovalForAll } from './write/setApprovalForAll'
import { erc721ItemsSetBaseMetadataURI } from './write/setBaseMetadataURI'
import { erc721ItemsSetContractURI } from './write/setContractURI'
import { erc721ItemsSetDefaultRoyalty } from './write/setDefaultRoyalty'
import { erc721ItemsSetImplicitModeProjectId } from './write/setImplicitModeProjectId'
import { erc721ItemsSetImplicitModeValidator } from './write/setImplicitModeValidator'
import { erc721ItemsSetNameAndSymbol } from './write/setNameAndSymbol'
import { erc721ItemsSetTokenRoyalty } from './write/setTokenRoyalty'
import { erc721ItemsTransferFrom } from './write/transferFrom'
import { erc721ItemsDEFAULT_ADMIN_ROLE } from './read/DEFAULT_ADMIN_ROLE'
import { erc721ItemsAcceptImplicitRequest } from './read/acceptImplicitRequest'
import { erc721ItemsBalanceOf } from './read/balanceOf'
import { erc721ItemsContractURI } from './read/contractURI'
import { erc721ItemsGetApproved } from './read/getApproved'
import { erc721ItemsGetRoleAdmin } from './read/getRoleAdmin'
import { erc721ItemsGetRoleMember } from './read/getRoleMember'
import { erc721ItemsGetRoleMemberCount } from './read/getRoleMemberCount'
import { erc721ItemsHasRole } from './read/hasRole'
import { erc721ItemsIsApprovedForAll } from './read/isApprovedForAll'
import { erc721ItemsName } from './read/name'
import { erc721ItemsOwnerOf } from './read/ownerOf'
import { erc721ItemsRoyaltyInfo } from './read/royaltyInfo'
import { erc721ItemsSupportsInterface } from './read/supportsInterface'
import { erc721ItemsSymbol } from './read/symbol'
import { erc721ItemsTokenURI } from './read/tokenURI'
import { erc721ItemsTotalSupply } from './read/totalSupply'

export function registerErc721ItemsRoutes(fastify: FastifyInstance) {
  erc721ItemsApprove(fastify)
  erc721ItemsGrantRole(fastify)
  erc721ItemsMintSequential(fastify)
  erc721ItemsRenounceRole(fastify)
  erc721ItemsRevokeRole(fastify)
  erc721ItemsSafeTransferFrom_1(fastify)
  erc721ItemsSafeTransferFrom_2(fastify)
  erc721ItemsSetApprovalForAll(fastify)
  erc721ItemsSetBaseMetadataURI(fastify)
  erc721ItemsSetContractURI(fastify)
  erc721ItemsSetDefaultRoyalty(fastify)
  erc721ItemsSetImplicitModeProjectId(fastify)
  erc721ItemsSetImplicitModeValidator(fastify)
  erc721ItemsSetNameAndSymbol(fastify)
  erc721ItemsSetTokenRoyalty(fastify)
  erc721ItemsTransferFrom(fastify)
  erc721ItemsDEFAULT_ADMIN_ROLE(fastify)
  erc721ItemsAcceptImplicitRequest(fastify)
  erc721ItemsBalanceOf(fastify)
  erc721ItemsContractURI(fastify)
  erc721ItemsGetApproved(fastify)
  erc721ItemsGetRoleAdmin(fastify)
  erc721ItemsGetRoleMember(fastify)
  erc721ItemsGetRoleMemberCount(fastify)
  erc721ItemsHasRole(fastify)
  erc721ItemsIsApprovedForAll(fastify)
  erc721ItemsName(fastify)
  erc721ItemsOwnerOf(fastify)
  erc721ItemsRoyaltyInfo(fastify)
  erc721ItemsSupportsInterface(fastify)
  erc721ItemsSymbol(fastify)
  erc721ItemsTokenURI(fastify)
  erc721ItemsTotalSupply(fastify)
}