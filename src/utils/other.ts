import type { NetworkConfig } from '@0xsequence/network'
import { findSupportedNetwork } from '@0xsequence/network'
import { type TransactionReceipt, ethers } from 'ethers'

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
