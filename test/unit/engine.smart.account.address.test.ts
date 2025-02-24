import { erc20Abi } from 'viem'
import { describe, it, expect } from 'vitest'

describe('Get Sidekick Smart Account Wallet', () => {
    it('should get sidekick smart account wallet address', async () => {
        const response = await fetch(
            `http://127.0.0.1:${process.env.PORT}/sidekick/smart-account-address`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                },
            }
        )

        const payload = await response.json()

        console.log(payload)

        expect(response.status).toBe(200)
    })
})
