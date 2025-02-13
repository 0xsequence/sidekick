import { test } from 'vitest'

test('POST /webhook/add - should add a new webhook listener', async (t) => {
    const response = await fetch('http://localhost:3000/webhook/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-secret-key': 'sequence'
        },
        body: JSON.stringify({
            url: 'https://webhook.site/86a0a256-b0bd-4c70-86cc-d51a24a1deba',
            events: ['Approval(address owner, address spender, address value)'],
            contractAddresses: ['0xC333a24E018caE739c984Fc0dbeFC8B62562d9Bf']
        })
    })

    const data = await response.json()
    
    // Log the full response structure
    console.log('Full Response:', JSON.stringify(data, null, 2))
    
    t.expect(response.status).toBe(200)
    t.expect(data.result).toBeDefined()
    t.expect(data.result.data.webhook).toBeDefined()
    // Add more specific assertions based on expected webhook structure
    t.expect(data.result.data.webhook.url).toBe('https://webhook.site/86a0a256-b0bd-4c70-86cc-d51a24a1deba')
    t.expect(data.result.data.webhook.filters).toBeDefined()
    t.expect(data.result.data.status).toBe(true)
})
