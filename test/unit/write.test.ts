import { erc20Abi } from 'viem'
import { describe, it, expect } from 'vitest'
import setup from '../setup'
import type { WriteContractResponse } from '../../src/routes/contract/write/write'
import { erc721Abi } from '../../src/constants/abis/erc721'

describe('Contract Write', () => {

    const { chainId, erc20ContractAddress, erc721ContractAddress, recipient, secretKey } = setup()

    it.skip('should transfer ERC20 tokens from sidekick smart wallet to recipient', async () => {
        const functionName = 'transfer'
        const response = await fetch(
            `http://127.0.0.1:3000/contract/${chainId}/${erc20ContractAddress}/write/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                    'x-secret-key': secretKey,
                },
                body: JSON.stringify({
                    args: [recipient, 100],
                    abi: erc20Abi
                })
            }
        )

        const payload = await response.json() as WriteContractResponse

        console.log(payload)

        expect(response.status).toBe(200)
        expect(payload?.result?.txHash).toBeDefined()
        expect(payload?.result?.txUrl).toBeDefined()
    }, 10000)

    it('should transfer ERC20 tokens from sidekick smart wallet to recipient without providing abi', async () => {
        const functionName = 'transfer'
        const response = await fetch(
            `http://127.0.0.1:3000/contract/${chainId}/${erc20ContractAddress}/write/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                    'x-secret-key': secretKey,
                },
                body: JSON.stringify({
                    args: [recipient, 100],
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
                },
                body: JSON.stringify({
                    args: [recipient, 101],
                    abi: erc721Abi
                })
            }
        )

        const payload = await response.json() as WriteContractResponse

        console.log(payload)

        expect(response.status).toBe(200)
        expect(payload?.result?.txHash).toBeDefined()
        expect(payload?.result?.txUrl).toBeDefined()
    }, 10000)

    it('should mint batch of NFTs to recipients', async () => {
        const response = await fetch(
            `http://127.0.0.1:3000/erc721/${chainId}/${erc721ContractAddress}/safeMintBatch`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                    'x-secret-key': secretKey,
                },
                body: JSON.stringify({
                    recipients: [recipient, recipient],
                    tokenIds: [101, 102]
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
