#!/usr/bin/env tsx
/**
 * Script to validate OpenAPI specification compatibility
 * Fetches the OpenAPI spec from a running server and validates it
 */

import SwaggerParser from '@apidevtools/swagger-parser'

// Get server URL from environment or use default
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7500'

// Common OpenAPI endpoint paths
const POSSIBLE_ENDPOINTS = [
	'/documentation/json', // Fastify Swagger UI default
	'/openapi.json',
	'/swagger.json',
	'/documentation/openapi.json'
]

async function fetchOpenAPISpec(): Promise<Record<string, unknown>> {
	let lastError: Error | null = null

	for (const endpoint of POSSIBLE_ENDPOINTS) {
		const url = `${SERVER_URL}${endpoint}`
		try {
			const response = await fetch(url)
			if (response.ok) {
				const spec = (await response.json()) as Record<string, unknown>
				console.log(`✓ Found OpenAPI spec at: ${url}\n`)
				return spec
			}
		} catch (error) {
			if (error instanceof Error) {
				lastError = error
			}
			// Try next endpoint
			continue
		}
	}

	// If we get here, none of the endpoints worked
	if (lastError && lastError.message.includes('fetch failed')) {
		throw new Error(
			`Could not connect to server at ${SERVER_URL}. Make sure the server is running.\n` +
				`You can start it with: pnpm run dev`
		)
	}

	throw new Error(
		`Could not find OpenAPI spec at any of the expected endpoints:\n` +
			POSSIBLE_ENDPOINTS.map((ep) => `  - ${SERVER_URL}${ep}`).join('\n') +
			`\n\nMake sure the server is running and Swagger is properly configured.`
	)
}

async function validateOpenAPI(spec: Record<string, unknown>): Promise<void> {
	try {
		// Validate the spec structure and references
		// Cast to any to satisfy SwaggerParser's type requirements
		const api = await SwaggerParser.validate(spec as any, {
			validate: {
				spec: true,
				schema: true
			},
			dereference: {
				circular: false
			}
		})

		// Type guard for API document
		const apiDoc = api as unknown as Record<string, unknown>
		const info = apiDoc.info as Record<string, unknown> | undefined
		const paths = apiDoc.paths as Record<string, unknown> | undefined

		console.log('✅ OpenAPI specification is valid!')
		console.log(`   Title: ${info?.title || 'N/A'}`)
		console.log(`   Version: ${info?.version || 'N/A'}`)
		console.log(
			`   OpenAPI Version: ${apiDoc.openapi || apiDoc.swagger || 'N/A'}`
		)
		console.log(`   Paths: ${Object.keys(paths || {}).length}`)

		// Check for common issues
		const warnings: string[] = []

		if (!paths || Object.keys(paths).length === 0) {
			warnings.push('⚠️  No API paths defined')
		}

		// Check for missing response schemas
		for (const [path, pathItem] of Object.entries(paths || {})) {
			if (!pathItem) continue
			for (const [method, operation] of Object.entries(pathItem)) {
				if (
					typeof operation === 'object' &&
					operation !== null &&
					'responses' in operation
				) {
					const responses = operation.responses
					if (!responses || Object.keys(responses).length === 0) {
						warnings.push(
							`⚠️  ${method.toUpperCase()} ${path} has no response definitions`
						)
					}
				}
			}
		}

		if (warnings.length > 0) {
			console.log('\n⚠️  Warnings:')
			warnings.forEach((warning) => console.log(`   ${warning}`))
		}

		console.log('\n✅ All validation checks passed!')
	} catch (error) {
		if (error instanceof Error) {
			console.error('❌ OpenAPI validation failed:')
			console.error(`   ${error.message}`)
			if ('details' in error && Array.isArray(error.details)) {
				console.error('\n   Details:')
				error.details.forEach((detail: unknown) => {
					if (typeof detail === 'object' && detail !== null) {
						console.error(`   - ${JSON.stringify(detail, null, 2)}`)
					}
				})
			}
		} else {
			console.error('❌ Unknown validation error:', error)
		}
		process.exit(1)
	}
}

async function main() {
	console.log(`🔍 Validating OpenAPI specification from ${SERVER_URL}...\n`)

	try {
		const spec = await fetchOpenAPISpec()
		await validateOpenAPI(spec)
	} catch (error) {
		if (error instanceof Error) {
			console.error('❌ Error:', error.message)
		} else {
			console.error('❌ Unknown error:', error)
		}
		process.exit(1)
	}
}

main()
