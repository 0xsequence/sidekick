import type { commons } from '@0xsequence/core'

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

export type TransactionReceipt = {
	type: string
	root: string
	status: string
	cumulativeGasUsed: string
	logsBloom: string
	logs: Array<{
		address: string
		topics: string[]
		data: string
		blockNumber: string
		transactionHash: string
		transactionIndex: string
		blockHash: string
		logIndex: string
		removed: boolean
	}>
	transactionHash: string
	contractAddress: string
	gasUsed: string
	effectiveGasPrice: string
	blockHash: string
	blockNumber: string
	transactionIndex: string
}
