import { Session } from '@0xsequence/auth'
import { AwsKmsSigner } from '@0xsequence/aws-kms-signer'
import { GoogleKmsSigner } from '@0xsequence/google-kms-signer'
import { findSupportedNetwork } from '@0xsequence/network'
import type { NetworkConfig } from '@0xsequence/network'
import { ethers } from 'ethers'
import { logger } from './logger'
import { getOrCreateDevKey } from './other'

export const getProvider = async (chainConfig: NetworkConfig) => {
	const provider = new ethers.JsonRpcProvider(
		chainConfig.rpcUrl,
		chainConfig.chainId
	)
	return provider
}

export const getRelayer = async (chainHandle: string) => {
	try {
		const chainConfig: NetworkConfig | undefined =
			findSupportedNetwork(chainHandle)

		if (!chainConfig) {
			throw new Error(`Chain config not found for chain handle: ${chainHandle}`)
		}

		const provider = await getProvider(chainConfig)

		const walletEOA = new ethers.Wallet(
			process.env.BACKEND_WALLET_PV_KEY || getOrCreateDevKey(),
			provider
		)
		const smartAccount = await Session.singleSigner({
			signer: walletEOA,
			projectAccessKey: process.env.SEQUENCE_PROJECT_ACCESS_KEY as string
		})

		return smartAccount.account.relayer(chainConfig.chainId)
	} catch (err) {
		logger.error(`Error getting local signer: ${err}`)
		throw err
	}
}

export const getLocalSigner = async (chainHandle: string) => {
	try {
		const chainConfig: NetworkConfig | undefined =
			findSupportedNetwork(chainHandle)

		if (!chainConfig) {
			throw new Error(`Chain config not found for chain handle: ${chainHandle}`)
		}

		const provider = await getProvider(chainConfig)

		const walletEOA = new ethers.Wallet(
			process.env.BACKEND_WALLET_PV_KEY || getOrCreateDevKey(),
			provider
		)
		const smartAccount = await Session.singleSigner({
			signer: walletEOA,
			projectAccessKey: process.env.SEQUENCE_PROJECT_ACCESS_KEY as string
		})

		return smartAccount.account.getSigner(chainConfig.chainId)
	} catch (err) {
		logger.error(`Error getting local signer: ${err}`)
		throw err
	}
}

export const getGoogleKmsSigner = async (chainHandle: string) => {
	try {
		const chainConfig: NetworkConfig | undefined =
			findSupportedNetwork(chainHandle)

		if (!chainConfig) {
			throw new Error(`Chain config not found for chain handle: ${chainHandle}`)
		}

		const googleKmsSigner = new GoogleKmsSigner({
			project: process.env.PROJECT as string,
			location: process.env.LOCATION as string,
			keyRing: process.env.KEY_RING as string,
			cryptoKey: process.env.CRYPTO_KEY as string,
			cryptoKeyVersion: process.env.CRYPTO_KEY_VERSION as string
		})

		const smartAccount = await Session.singleSigner({
			signer: googleKmsSigner,
			projectAccessKey: process.env.SEQUENCE_PROJECT_ACCESS_KEY as string
		})

		return smartAccount.account.getSigner(chainConfig.chainId)
	} catch (err) {
		console.error(`ERROR: ${err}`)
		throw err
	}
}

export const getAwsKmsSigner = async (chainHandle: string) => {
	try {
		const chainConfig: NetworkConfig | undefined =
			findSupportedNetwork(chainHandle)

		if (!chainConfig) {
			throw new Error(`Chain config not found for chain handle: ${chainHandle}`)
		}

		const awsKmsSigner = new AwsKmsSigner(
			process.env.AWS_REGION as string,
			process.env.AWS_KMS_KEY_ID as string
		)

		const smartAccount = await Session.singleSigner({
			signer: awsKmsSigner,
			projectAccessKey: process.env.SEQUENCE_PROJECT_ACCESS_KEY as string
		})

		return smartAccount.account.getSigner(chainConfig.chainId)
	} catch (err) {
		console.error(`ERROR: ${err}`)
		throw err
	}
}

export const getSigner = async (chainHandle: string) => {
	if (process.env.SIGNER_TYPE === 'local') {
		return getLocalSigner(chainHandle)
	}
	if (process.env.SIGNER_TYPE === 'google_kms') {
		return getGoogleKmsSigner(chainHandle)
	}
	if (process.env.SIGNER_TYPE === 'aws_kms') {
		return getAwsKmsSigner(chainHandle)
	}

	return getLocalSigner(chainHandle)
}
