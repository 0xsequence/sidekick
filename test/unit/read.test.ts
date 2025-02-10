import { erc20Abi } from 'viem'
import { describe, it, expect } from 'vitest'
import setup from '../setup'

describe('Contract Read', () => {

    const { chainId, contractAddress, engineSmartWallet: owner, secretKey } = setup()
    const functionName = 'balanceOf'

    it('should read ERC20 balance from contract', async () => {
        const response = await fetch(
            `http://127.0.0.1:3000/contract/${chainId}/${contractAddress}/read/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                    'x-secret-key': secretKey
                },
                body: JSON.stringify({
                    args: JSON.stringify([owner]),
                    abi: JSON.stringify(erc20Abi)
                })
            }
        )

        const payload = await response.json()

        console.log(payload)

        expect(response.status).toBe(200)
    })
})
