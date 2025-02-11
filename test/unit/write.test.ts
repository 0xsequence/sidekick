import { erc20Abi } from 'viem'
import { describe, it, expect } from 'vitest'
import setup from '../setup'
import type { WriteContractResponse } from '../../src/routes/contract/write/write'
import { erc721Abi } from '../../src/constants/abis/erc721'

describe('Contract Write', () => {

    const { chainId, erc20ContractAddress, erc721ContractAddress, recipient, secretKey, engineSmartWallet } = setup()

    it.skip('should transfer ERC20 tokens from engine smart wallet to recipient', async () => {
        const functionName = 'transfer'
        const response = await fetch(
            `http://127.0.0.1:3000/contract/${chainId}/${erc20ContractAddress}/write/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                    'x-secret-key': secretKey,
                    'x-wallet-address': engineSmartWallet
                },
                body: JSON.stringify({
                    args: JSON.stringify([recipient, 100]),
                    abi: JSON.stringify(erc20Abi)
                })
            }
        )

        const payload = await response.json() as WriteContractResponse

        console.log(payload)

        expect(response.status).toBe(200)
        expect(payload?.result?.txHash).toBeDefined()
        expect(payload?.result?.txUrl).toBeDefined()
    }, 10000)

    it('should mint an NFT to recipient', async () => {
        const functionName = 'safeMint'
        const response = await fetch(
            `http://127.0.0.1:3000/contract/${chainId}/${erc721ContractAddress}/write/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                    'x-secret-key': secretKey,
                    'x-wallet-address': engineSmartWallet
                },
                body: JSON.stringify({
                    args: JSON.stringify([recipient, 101]),
                    abi: JSON.stringify(erc721Abi)
                })
            }
        )

        const payload = await response.json() as WriteContractResponse

        console.log(payload)

        expect(response.status).toBe(200)
        expect(payload?.result?.txHash).toBeDefined()
        expect(payload?.result?.txUrl).toBeDefined()
    }, 10000)
})
