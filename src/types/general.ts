import { commons } from "@0xsequence/core"

export type TenderlySimulatorUrlOptions = {
	chainId: number | string
	from?: string
	gas?: number | string
	gasPrice?: number | string
	value?: number | string
	block?: number | string
	blockIndex?: number | string
	contractAddress?: string
	contractFunction?: string
	rawFunctionInput?: string
	functionInputs?: unknown[]
}

export type TransactionResponse = commons.transaction.TransactionResponse