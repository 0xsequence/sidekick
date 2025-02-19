import { findSupportedNetwork } from "@0xsequence/network";
import { Session } from "@0xsequence/auth"
import type { NetworkConfig } from "@0xsequence/network";
import { ethers } from "ethers";
import { GoogleKmsSigner } from "@0xsequence/google-kms-signer";

export const getLocalSigner = async (chainHandle: string) => {
    try {
        const chainConfig: NetworkConfig = findSupportedNetwork(chainHandle)!

        const provider = new ethers.JsonRpcProvider(process.env.SEQUENCE_RPC_URL)

        const walletEOA = new ethers.Wallet(process.env.EVM_PRIVATE_KEY!, provider);

        const smartAccount = await Session.singleSigner({
            signer: walletEOA,
            projectAccessKey: process.env.PROJECT_ACCESS_KEY!
        })

        return smartAccount.account.getSigner(chainConfig.chainId)
    } catch (err) {
        console.error(`ERROR: ${err}`)
        throw err
    }
}

export const getGoogleKmsSigner = async (chainHandle: string) => {
    try {
        const chainConfig: NetworkConfig = findSupportedNetwork(chainHandle)!

        const googleKmsSigner = new GoogleKmsSigner({
            project: process.env.PROJECT!,
            location: process.env.LOCATION!,
            keyRing: process.env.KEY_RING!,
            cryptoKey: process.env.CRYPTO_KEY!,
            cryptoKeyVersion: process.env.CRYPTO_KEY_VERSION!
        })

        const smartAccount = await Session.singleSigner({
            signer: googleKmsSigner,
            projectAccessKey: process.env.PROJECT_ACCESS_KEY!
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
    } else if (process.env.SIGNER_TYPE === 'google_kms') {
        return getGoogleKmsSigner(chainHandle)
    }

    return getLocalSigner(chainHandle)
}