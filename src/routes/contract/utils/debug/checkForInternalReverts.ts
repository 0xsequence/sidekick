import { Type } from '@sinclair/typebox'
import { type Provider, ethers, formatEther } from 'ethers'
import type { FastifyInstance } from 'fastify'
import { logger } from '~/utils/logger'

const CONTRACT_INFO_CACHE = new Map<string, { name: string }>()

type DebugTraceTransactionParams = { chainId: string; txHash: string }
type DebugTraceTransactionQuery = { rpcUrl: string }
type RawTraceCall = {
	from: string
	gas: string
	gasUsed: string
	to: string
	input: string
	output?: string
	error?: string
	value: string
	type: string
	calls?: RawTraceCall[]
}

type DecodedSignature = {
	functionName: string
	functionSignature: string
	parameters: Array<{ name: string; type: string; value: string }>
}

type SimplifiedTraceCall = {
	type: string
	from: string
	fromContractName: string
	to: string
	toContractName: string
	functionSelector: string
	decodedFunctionSelector: DecodedSignature
	value: string
	valueInEther: string
	gasUsed: string
	reverted: boolean
	revertReason?: string
	calls: SimplifiedTraceCall[]
}

type DebugCheckIfRevertedResponse = {
	result: {
		hasRevertedCalls: boolean
		revertReasons: string[]
		revertedCalls: SimplifiedTraceCall[]
		summary?: string
		error?: string
	}
}

const decodedSignatureSchema = Type.Object({
	functionName: Type.String(),
	functionSignature: Type.String(),
	parameters: Type.Array(
		Type.Object({
			name: Type.String(),
			type: Type.String(),
			value: Type.String()
		})
	)
})

const simplifiedTraceCallSchema = Type.Object({
	type: Type.String(),
	from: Type.String(),
	fromContractName: Type.String(),
	to: Type.String(),
	toContractName: Type.String(),
	functionSelector: Type.String(),
	decodedFunctionSelector: decodedSignatureSchema,
	value: Type.String(),
	valueInEther: Type.String(),
	gasUsed: Type.String(),
	reverted: Type.Boolean(),
	revertReason: Type.Optional(Type.String()),
	calls: Type.Array(Type.Any())
})

const debugCheckIfRevertedSchema = {
	description:
		'Checks if a transaction has internal reverted calls, returning all possible function signatures, decodings, and resolved contract names.',
	tags: ['Debug', 'Contract'],
	params: Type.Object({ chainId: Type.String(), txHash: Type.String() }),
	querystring: Type.Object({ rpcUrl: Type.String() }),
	response: {
		200: Type.Object({
			result: Type.Object({
				hasRevertedCalls: Type.Boolean(),
				revertReasons: Type.Array(Type.String()),
				summary: Type.Optional(Type.String()),
				revertedCalls: Type.Array(simplifiedTraceCallSchema),
				error: Type.Optional(Type.String())
			})
		})
	}
}

const getContractName = async (
	address: string,
	provider: Provider
): Promise<string> => {
	if (CONTRACT_INFO_CACHE.has(address)) {
		return CONTRACT_INFO_CACHE.get(address)!.name
	}
	try {
		// EOA (Externally Owned Account) check. Avoids unnecessary RPC calls.
		const code = await provider.getCode(address)
		if (code === '0x') {
			CONTRACT_INFO_CACHE.set(address, { name: 'EOA' })
			return 'EOA'
		}

		const minimalAbi = ['function name() view returns (string)']
		const contract = new ethers.Contract(address, minimalAbi, provider)
		const name = await Promise.race([
			contract.name(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Timeout')), 2000)
			)
		])

		if (typeof name === 'string' && name.length > 0) {
			CONTRACT_INFO_CACHE.set(address, { name })
			return name
		}
	} catch (error) {}

	const fallbackName = 'Unknown Contract'
	CONTRACT_INFO_CACHE.set(address, { name: fallbackName })
	return fallbackName
}

const fetchFunctionSignature = async (
	selector: string
): Promise<string | null> => {
	try {
		const response = await fetch(
			`https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`
		)
		if (!response.ok) return null
		const data = (await response.json()) as {
			results?: Array<{
				id: number
				text_signature: string
			}>
		}
		if (data.results && data.results.length > 0) {
			const sortedResults = data.results.sort((a, b) => a.id - b.id)
			return sortedResults[0].text_signature
		}
		return null
	} catch (error) {
		logger.warn(`Failed to fetch signature for ${selector}: ${error}`)
		return null
	}
}

const decodeAndFetchSignatures = async (
	input: string
): Promise<{ decodings: DecodedSignature[]; signatures: string[] }> => {
	if (!input || input === '0x' || input.length < 10)
		return { decodings: [], signatures: [] }
	const selector = input.slice(0, 10)
	const signature = await fetchFunctionSignature(selector)
	if (!signature) return { decodings: [], signatures: [] }

	const decodings: DecodedSignature[] = []
	try {
		const iface = new ethers.Interface([`function ${signature}`])
		const decoded = iface.parseTransaction({ data: input })
		if (decoded) {
			decodings.push({
				functionName: decoded.name,
				functionSignature: signature,
				parameters: decoded.args.map((arg, i) => ({
					name: decoded.fragment.inputs[i]?.name || `param${i}`,
					type: decoded.fragment.inputs[i]?.type,
					value: arg.toString()
				}))
			})
		}
	} catch (e) {
		throw new Error(
			`Failed to decode function call with signature ${signature}: ${e}`
		)
	}
	return { decodings, signatures: [signature] }
}

const getRevertReason = (output?: string): string | undefined => {
	if (!output || !output.startsWith('0x08c379a0'))
		return 'Execution reverted without a reason string'
	try {
		return new ethers.Interface(['function Error(string)']).decodeErrorResult(
			'Error',
			output
		)[0]
	} catch (e) {
		return 'Execution reverted with unrecognized error format.'
	}
}

const transformTrace = async (
	call: RawTraceCall,
	provider: Provider
): Promise<SimplifiedTraceCall> => {
	const { decodings, signatures } = await decodeAndFetchSignatures(call.input)
	const reverted = !!call.error

	const [fromContractName, toContractName] = await Promise.all([
		getContractName(call.from, provider),
		getContractName(call.to, provider)
	])

	return {
		type: call.type,
		from: call.from,
		fromContractName,
		to: call.to,
		toContractName,
		functionSelector: call.input.slice(0, 10),
		decodedFunctionSelector: decodings[0],
		value: call.value ? BigInt(call.value).toString() : '0',
		valueInEther: call.value ? formatEther(BigInt(call.value)) : '0',
		gasUsed: call.gasUsed ? BigInt(call.gasUsed).toString() : '0',
		reverted,
		revertReason: reverted
			? call.error === 'execution reverted'
				? getRevertReason(call.output)
				: call.error
			: undefined,
		calls: call.calls
			? await Promise.all(call.calls.map((c) => transformTrace(c, provider)))
			: []
	}
}

const findRevertedCalls = (
	calls: SimplifiedTraceCall[]
): SimplifiedTraceCall[] => {
	const reverted: SimplifiedTraceCall[] = []
	const traverse = (callList: SimplifiedTraceCall[]) => {
		for (const call of callList) {
			if (call.reverted) reverted.push(call)
			if (call.calls?.length > 0) traverse(call.calls)
		}
	}
	traverse(calls)
	return reverted
}

const findDeepestRevertedCall = (
	calls: SimplifiedTraceCall[]
): SimplifiedTraceCall | null => {
	let deepestReverted: SimplifiedTraceCall | null = null
	let maxDepth = -1

	const traverse = (callList: SimplifiedTraceCall[], depth = 0) => {
		for (const call of callList) {
			if (call.reverted && depth > maxDepth) {
				deepestReverted = call
				maxDepth = depth
			}
			if (call.calls?.length > 0) {
				traverse(call.calls, depth + 1)
			}
		}
	}

	traverse(calls)
	return deepestReverted
}

const generateSummary = (
	txHash: string,
	deepestReverted: SimplifiedTraceCall | null
): string => {
	if (!deepestReverted) {
		return `Transaction ${txHash} completed successfully`
	}

	const functionSignature =
		deepestReverted.decodedFunctionSelector?.functionSignature ||
		'Unknown Function'
	const revertReason = deepestReverted.revertReason || 'Unknown reason'

	return `Function ${functionSignature}() reverted with reason "${revertReason}". Parameters used: ${deepestReverted.decodedFunctionSelector?.parameters.map((p) => `${p.value}`).join(', ')}`
}

export async function checkForInternalReverts(fastify: FastifyInstance) {
	fastify.addHook('onRequest', (request, reply, done) => {
		CONTRACT_INFO_CACHE.clear()
		done()
	})

	fastify.get<{
		Params: DebugTraceTransactionParams
		Querystring: DebugTraceTransactionQuery
		Reply: DebugCheckIfRevertedResponse
	}>(
		'/debug/checkForInternalReverts/:chainId/:txHash',
		{ schema: debugCheckIfRevertedSchema },
		async (request, reply) => {
			try {
				const { chainId, txHash } = request.params
				const { rpcUrl } = request.query
				const chainIdNumber = Number.parseInt(chainId, 10)
				if (Number.isNaN(chainIdNumber))
					return reply.code(400).send({
						result: {
							hasRevertedCalls: false,
							revertReasons: [],
							revertedCalls: [],
							error: 'Invalid chain ID.'
						}
					})
				if (!/^0x[a-fA-F0-9]{64}$/.test(txHash))
					return reply.code(400).send({
						result: {
							hasRevertedCalls: false,
							revertReasons: [],
							revertedCalls: [],
							error: 'Invalid transaction hash format.'
						}
					})

				const provider = new ethers.JsonRpcProvider(rpcUrl, chainIdNumber)
				logger.info(
					`Checking for reverts in transaction ${txHash} on chain ${chainId}`
				)
				const rawTrace = await provider.send('debug_traceTransaction', [
					txHash,
					{ tracer: 'callTracer' }
				])
				if (!rawTrace)
					return reply.code(200).send({
						result: {
							hasRevertedCalls: false,
							revertReasons: [],
							revertedCalls: []
						}
					})

				const simplifiedTrace = await transformTrace(rawTrace, provider)
				const revertedCalls = findRevertedCalls([simplifiedTrace])
				const revertReasons = Array.from(
					new Set(
						revertedCalls.map((c) => c.revertReason).filter(Boolean) as string[]
					)
				)
				const deepestReverted = findDeepestRevertedCall([simplifiedTrace])
				const summary = generateSummary(txHash, deepestReverted)

				return reply.code(200).send({
					result: {
						hasRevertedCalls: revertedCalls.length > 0,
						revertReasons,
						revertedCalls,
						summary
					}
				})
			} catch (error: any) {
				logger.error(`Error checking for reverts: ${error}`)
				return reply.code(500).send({
					result: {
						hasRevertedCalls: false,
						revertReasons: [],
						revertedCalls: [],
						error: error.message
					}
				})
			}
		}
	)
}
