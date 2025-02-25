import { findSupportedNetwork } from "@0xsequence/network";
import { Session } from "@0xsequence/auth"
import type { NetworkConfig } from "@0xsequence/network";
import { ethers } from "ethers";
import { GoogleKmsSigner } from "@0xsequence/google-kms-signer";
import { AwsKmsSigner } from "./aws_kms_signer";

export const getProvider = async () => {
    const provider = new ethers.JsonRpcProvider(process.env.SEQUENCE_RPC_URL)
    return provider
}

export const getLocalSigner = async (chainHandle: string) => {
    try {
        const chainConfig: NetworkConfig | undefined = findSupportedNetwork(chainHandle)

        if (!chainConfig) {
            throw new Error(`Chain config not found for chain handle: ${chainHandle}`)
        }

        const provider = await getProvider()

        const walletEOA = new ethers.Wallet(process.env.EVM_PRIVATE_KEY ?? '', provider);

        const smartAccount = await Session.singleSigner({
            signer: walletEOA,
            projectAccessKey: process.env.PROJECT_ACCESS_KEY ?? ''
        })

        return smartAccount.account.getSigner(chainConfig.chainId)
    } catch (err) {
        console.error(`ERROR: ${err}`)
        throw err
    }
}

export const getGoogleKmsSigner = async (chainHandle: string) => {
    try {
        const chainConfig: NetworkConfig | undefined = findSupportedNetwork(chainHandle)

        if (!chainConfig) {
            throw new Error(`Chain config not found for chain handle: ${chainHandle}`)
        }

        const googleKmsSigner = new GoogleKmsSigner({
            project: process.env.PROJECT ?? '',
            location: process.env.LOCATION ?? '',
            keyRing: process.env.KEY_RING ?? '',
            cryptoKey: process.env.CRYPTO_KEY ?? '',
            cryptoKeyVersion: process.env.CRYPTO_KEY_VERSION ?? ''
        })

        const smartAccount = await Session.singleSigner({
            signer: googleKmsSigner,
            projectAccessKey: process.env.PROJECT_ACCESS_KEY ?? ''
        })

        return smartAccount.account.getSigner(chainConfig.chainId)
    } catch (err) {
        console.error(`ERROR: ${err}`)
        throw err
    }
}

export const getAwsKmsSigner = async (chainHandle: string) => {
    try {
        const chainConfig: NetworkConfig | undefined = findSupportedNetwork(chainHandle)

        if (!chainConfig) {
            throw new Error(`Chain config not found for chain handle: ${chainHandle}`)
        }

        const awsKmsSigner = new AwsKmsSigner(
            process.env.AWS_REGION ?? '',
            process.env.AWS_KMS_KEY_ID ?? ''
        )

        const smartAccount = await Session.singleSigner({
            signer: awsKmsSigner,
            projectAccessKey: process.env.PROJECT_ACCESS_KEY ?? ''
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