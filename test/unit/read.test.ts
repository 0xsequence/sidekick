import { erc20Abi } from 'viem'
import { describe, it, expect } from 'vitest'
import setup from '../setup'

describe('Contract Read', () => {

    const { chainId, erc20ContractAddress, sidekickSmartWallet: owner, secretKey } = setup()
    const functionName = 'balanceOf'

    it('should read ERC20 balance from contract', async () => {
        const response = await fetch(
            `http://127.0.0.1:3000/contract/${chainId}/${erc20ContractAddress}/read/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-secret-key': secretKey
                },
                body: JSON.stringify({
                    args: [owner],
                    abi: erc20Abi
                })
            }
        )

        const payload = await response.json()

        console.log(payload)

        expect(response.status).toBe(200)
    })

    it('should read ERC20 balance from contract, without providing abi', async () => {
        const response = await fetch(
            `http://127.0.0.1:3000/contract/${chainId}/${erc20ContractAddress}/read/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-secret-key': secretKey
                },
                body: JSON.stringify({
                    args: [owner],
                })
            }
        )

        const payload = await response.json()

        console.log(payload)

        expect(response.status).toBe(200)
    })
})
