import fs from 'node:fs'
import type { NetworkConfig } from '@0xsequence/network'
import { findSupportedNetwork } from '@0xsequence/network'
import { type TransactionReceipt, ethers } from 'ethers'
import { logger } from './logger'

// Helper function to validate Ethereum addresses
export const isValidEthereumAddress = (address: string): boolean => {
	return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Helper function to get block explorer URL
export const getBlockExplorerUrl = (
	chainId: number,
	txHash: string
): string => {
	// Add more networks as needed
	const chainConfig: NetworkConfig = findSupportedNetwork(chainId)!
	const baseUrl = chainConfig.blockExplorer?.rootUrl
	return baseUrl ? `${baseUrl}tx/${txHash}` : ''
}

export const getContractAddressFromEvent = (
	receipt: TransactionReceipt | null,
	eventName: string
): string => {
	const contractCreatedEvent = receipt?.logs.find((log) =>
		log.topics.includes(ethers.id('CreatedContract(address)'))
	)
	return ethers.getAddress(
		ethers.zeroPadValue(
			ethers.stripZerosLeft(contractCreatedEvent?.data ?? ''),
			20
		)
	)
}

const DEV_KEY_PATH = './dev.key'

export const getOrCreateDevKey = () => {
	logger.warn(
		`BACKEND_WALLET_PV_KEY was not provided, checking for dev key at ${DEV_KEY_PATH}`
	)
	if (fs.existsSync(DEV_KEY_PATH)) {
		logger.warn(`Dev key found at ${DEV_KEY_PATH}`)
		return fs.readFileSync(DEV_KEY_PATH, 'utf-8').trim()
	}
	logger.warn(
		`Dev key not found at ${DEV_KEY_PATH}, generating a new dev private key, do not use this for production. Copy, paste it into your .env as BACKEND_WALLET_PV_KEY and delete dev.key file.`
	)
	const wallet = ethers.Wallet.createRandom()
	fs.writeFileSync(DEV_KEY_PATH, wallet.privateKey)
	return wallet.privateKey
}

export const extractTxHashFromErrorReceipt = (error: any) => {
	let errorTxHash: string | null = null

	if ((error as any)?.receipt?.txnReceipt) {
		const txnReceiptString = (error as any).receipt.txnReceipt
		try {
			const txnReceipt = JSON.parse(txnReceiptString)
			errorTxHash = txnReceipt.transactionHash
		} catch (parseError) {
			console.log('Failed to parse txnReceipt:', parseError)
		}
	}

	// If we have logs, we can also get the hash from the first log
	if ((error as any)?.receipt?.logs?.[0]?.transactionHash) {
		errorTxHash = (error as any).receipt.logs[0].transactionHash
	}

	return errorTxHash
}