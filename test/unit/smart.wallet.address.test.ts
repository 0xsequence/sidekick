import { describe, it, expect } from 'vitest'

describe('Get Sidekick Wallet Address', () => {
    it('should get sidekick wallet address', async () => {
        const response = await fetch(
            `http://127.0.0.1:${process.env.PORT}/sidekick/wallet-address`,
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
