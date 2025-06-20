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
