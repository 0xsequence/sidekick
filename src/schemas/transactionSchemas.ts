import { Type } from "@sinclair/typebox";

export const TransactionSchema = Type.Object({
    id: Type.String(),
    hash: Type.String(),
    chainId: Type.Integer(),
    status: Type.String(),
    from: Type.String(),
    to: Type.String(),
    data: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
})
