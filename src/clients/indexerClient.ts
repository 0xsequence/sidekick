import { SequenceIndexer } from '@0xsequence/indexer'

export const indexerClient = (indexerUrl: string): SequenceIndexer | null => {
	if (
		!indexerUrl ||
		!process.env.SEQUENCE_PROJECT_ACCESS_KEY ||
		!process.env.BUILDER_API_SECRET_KEY
	) {
		console.log('Indexer Client not initialized')
		return null
	}

	return new SequenceIndexer(
		indexerUrl,
		process.env.SEQUENCE_PROJECT_ACCESS_KEY as string,
		process.env.BUILDER_API_SECRET_KEY as string
	)
}
