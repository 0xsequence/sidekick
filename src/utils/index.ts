import { Session } from "@0xsequence/auth"
import type { NetworkConfig } from "@0xsequence/network"
import { findSupportedNetwork } from "@0xsequence/network"
import type { Interface } from "ethers"
import { ethers } from "ethers"

// Helper function to validate Ethereum addresses
export const isValidEthereumAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Helper function to get block explorer URL
export const getBlockExplorerUrl = (chainId: number, txHash: string): string => {
    // Add more networks as needed
    const chainConfig: NetworkConfig = findSupportedNetwork(chainId)!
    const baseUrl = chainConfig.blockExplorer?.rootUrl
    return baseUrl ? `${baseUrl}/tx/${txHash}` : ''
}

// Method to get a Sequence signer wallet for the EOA wallet defined in the .env file
export const getSigner = async (chainHandle: string) => {
    try {
        const chainConfig: NetworkConfig = findSupportedNetwork(chainHandle)!

        const provider = new ethers.JsonRpcProvider(process.env.SEQUENCE_RPC_URL)

        const walletEOA = new ethers.Wallet(process.env.EVM_PRIVATE_KEY!, provider);

        // Create a single signer sequence wallet session
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

export const getAbiFromExplorer = async (chainId: string, contractAddress: string): Promise<Interface> => {
    const apiUrl = `https://api-sepolia.basescan.org/api?module=contract&action=getabi&address=${contractAddress}&apikey=${process.env.ETHERSCAN_API_KEY}`
    const response = await fetch(apiUrl)
    const data = await response.json() as { result: string }
    return new ethers.Interface(data.result)
}