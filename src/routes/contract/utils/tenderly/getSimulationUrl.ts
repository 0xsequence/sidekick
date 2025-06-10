import { commons } from '@0xsequence/core'
import type { TenderlySimulatorUrlOptions } from '~/types/general'

export type TenderlyTransaction = {
	data: string
	to?: string
}

export const getTenderlySimulationUrl = ({
	chainId,
	gas,
	gasPrice,
	value = '0',
	block,
	blockIndex,
	contractAddress,
	contractFunction,
	rawFunctionInput,
	functionInputs
}: TenderlySimulatorUrlOptions): string => {
	const accountSlug = process.env.TENDERLY_ACCOUNT_SLUG as string
	const projectSlug = process.env.TENDERLY_PROJECT_SLUG as string

	const baseUrl = `https://dashboard.tenderly.co/${accountSlug}/${projectSlug}/simulator/new`
	const params = new URLSearchParams({
		network: chainId.toString(),
		value: value.toString()
	})

	if (rawFunctionInput) params.set('rawFunctionInput', rawFunctionInput)
	if (gas) params.set('gas', gas.toString())
	if (gasPrice) params.set('gasPrice', gasPrice.toString())
	if (block) params.set('block', block.toString())
	if (blockIndex) params.set('blockIndex', blockIndex.toString())
	if (contractAddress) params.set('contractAddress', contractAddress)
	if (contractFunction) params.set('contractFunction', contractFunction)
	if (functionInputs && functionInputs.length > 0) {
		params.set('functionInputs', JSON.stringify(functionInputs))
	}

	return `${baseUrl}?${params.toString()}`
}

export const prepareTransactionsForTenderlySimulation = async (
	signer: any,
	txs: TenderlyTransaction[],
	chainId: number
): Promise<{ simulationData: string; signedTx: any }> => {
	const signedTx = await signer.account.signTransactions(txs, chainId)
	const simulationData = commons.transaction.encodeBundleExecData(signedTx)

	return { simulationData, signedTx }
}
