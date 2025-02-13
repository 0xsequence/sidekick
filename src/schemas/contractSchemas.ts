import { Type } from "@sinclair/typebox";

export const ContractSchema = Type.Object({
    id: Type.Integer(),
    projectId: Type.Optional(Type.Integer()),
    contractName: Type.String(),
    contractAddress: Type.String(),
    contractType: Type.Optional(Type.String()),
    chainId: Type.Integer(),
    source: Type.Optional(Type.String()),
    itemsContractAddress: Type.Optional(Type.String()),
    splitterContractAddresses: Type.Array(Type.String()),
    abi: Type.Optional(Type.String()),
    bytecode: Type.String(),
    bytecode_hash: Type.Optional(Type.String()),
    audienceId: Type.Optional(Type.Integer()),
    symbol: Type.Optional(Type.String()),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    addedBy: Type.String()
})