import type { FastifyInstance } from 'fastify'

import { erc1155ItemsBatchBurn } from './write/batchBurn'
import { erc1155ItemsBatchMint } from './write/batchMint'
import { erc1155ItemsBurn } from './write/burn'
import { erc1155ItemsGrantRole } from './write/grantRole'
import { erc1155ItemsInitialize } from './write/initialize'
import { erc1155ItemsMint } from './write/mint'
import { erc1155ItemsRenounceRole } from './write/renounceRole'
import { erc1155ItemsRevokeRole } from './write/revokeRole'
import { erc1155ItemsSafeBatchTransferFrom } from './write/safeBatchTransferFrom'
import { erc1155ItemsSafeTransferFrom } from './write/safeTransferFrom'
import { erc1155ItemsSetApprovalForAll } from './write/setApprovalForAll'
import { erc1155ItemsSetBaseMetadataURI } from './write/setBaseMetadataURI'
import { erc1155ItemsSetContractName } from './write/setContractName'
import { erc1155ItemsSetContractURI } from './write/setContractURI'
import { erc1155ItemsSetDefaultRoyalty } from './write/setDefaultRoyalty'
import { erc1155ItemsSetImplicitModeProjectId } from './write/setImplicitModeProjectId'
import { erc1155ItemsSetImplicitModeValidator } from './write/setImplicitModeValidator'
import { erc1155ItemsSetTokenRoyalty } from './write/setTokenRoyalty'
import { erc1155ItemsDEFAULT_ADMIN_ROLE } from './read/DEFAULT_ADMIN_ROLE'
import { erc1155ItemsAcceptImplicitRequest } from './read/acceptImplicitRequest'
import { erc1155ItemsBalanceOf } from './read/balanceOf'
import { erc1155ItemsBalanceOfBatch } from './read/balanceOfBatch'
import { erc1155ItemsBaseURI } from './read/baseURI'
import { erc1155ItemsContractURI } from './read/contractURI'
import { erc1155ItemsGetRoleAdmin } from './read/getRoleAdmin'
import { erc1155ItemsGetRoleMember } from './read/getRoleMember'
import { erc1155ItemsGetRoleMemberCount } from './read/getRoleMemberCount'
import { erc1155ItemsHasRole } from './read/hasRole'
import { erc1155ItemsIsApprovedForAll } from './read/isApprovedForAll'
import { erc1155ItemsName } from './read/name'
import { erc1155ItemsRoyaltyInfo } from './read/royaltyInfo'
import { erc1155ItemsSupportsInterface } from './read/supportsInterface'
import { erc1155ItemsTokenSupply } from './read/tokenSupply'
import { erc1155ItemsTotalSupply } from './read/totalSupply'
import { erc1155ItemsUri } from './read/uri'

export function registerErc1155ItemsRoutes(fastify: FastifyInstance) {
  erc1155ItemsBatchBurn(fastify)
  erc1155ItemsBatchMint(fastify)
  erc1155ItemsBurn(fastify)
  erc1155ItemsGrantRole(fastify)
  erc1155ItemsInitialize(fastify)
  erc1155ItemsMint(fastify)
  erc1155ItemsRenounceRole(fastify)
  erc1155ItemsRevokeRole(fastify)
  erc1155ItemsSafeBatchTransferFrom(fastify)
  erc1155ItemsSafeTransferFrom(fastify)
  erc1155ItemsSetApprovalForAll(fastify)
  erc1155ItemsSetBaseMetadataURI(fastify)
  erc1155ItemsSetContractName(fastify)
  erc1155ItemsSetContractURI(fastify)
  erc1155ItemsSetDefaultRoyalty(fastify)
  erc1155ItemsSetImplicitModeProjectId(fastify)
  erc1155ItemsSetImplicitModeValidator(fastify)
  erc1155ItemsSetTokenRoyalty(fastify)
  erc1155ItemsDEFAULT_ADMIN_ROLE(fastify)
  erc1155ItemsAcceptImplicitRequest(fastify)
  erc1155ItemsBalanceOf(fastify)
  erc1155ItemsBalanceOfBatch(fastify)
  erc1155ItemsBaseURI(fastify)
  erc1155ItemsContractURI(fastify)
  erc1155ItemsGetRoleAdmin(fastify)
  erc1155ItemsGetRoleMember(fastify)
  erc1155ItemsGetRoleMemberCount(fastify)
  erc1155ItemsHasRole(fastify)
  erc1155ItemsIsApprovedForAll(fastify)
  erc1155ItemsName(fastify)
  erc1155ItemsRoyaltyInfo(fastify)
  erc1155ItemsSupportsInterface(fastify)
  erc1155ItemsTokenSupply(fastify)
  erc1155ItemsTotalSupply(fastify)
  erc1155ItemsUri(fastify)
}