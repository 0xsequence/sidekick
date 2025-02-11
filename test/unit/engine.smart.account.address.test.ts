import { erc20Abi } from 'viem'
import { describe, it, expect } from 'vitest'

describe('Get Engine Smart Account Wallet', () => {
    it('should get engine smart account wallet address', async () => {
        const response = await fetch(
            'http://127.0.0.1:3000/engine/smart-account-address',
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                    'x-chain-id': '84532'
                },
            }
        )

        const payload = await response.json()

        console.log(payload)

        expect(response.status).toBe(200)
    })
})
