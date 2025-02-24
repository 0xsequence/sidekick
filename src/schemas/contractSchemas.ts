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

export const abiTypeSchema = Type.Object({
    type: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    internalType: Type.Optional(Type.String()),
    stateMutability: Type.Optional(Type.String()),
    components: Type.Optional(
        Type.Array(
            Type.Object({
                type: Type.Optional(Type.String()),
                name: Type.Optional(Type.String()),
                internalType: Type.Optional(Type.String()),
            }),
        ),
    ),
});

export const AbiSchema = Type.Object({
    type: Type.String(),
    name: Type.Optional(Type.String()),
    inputs: Type.Optional(Type.Array(abiTypeSchema)),
    outputs: Type.Optional(Type.Array(abiTypeSchema)),
    stateMutability: Type.Optional(Type.String()),
});