import { SequenceIndexer } from "@0xsequence/indexer";

export const indexerClient = (): SequenceIndexer | null => {
    if (!process.env.INDEXER_URL || !process.env.SEQUENCE_PROJECT_ACCESS_KEY || !process.env.BUILDER_API_SECRET_KEY) {
        console.log('Indexer Client not initialized')
        return null
    }

    return new SequenceIndexer(
        process.env.INDEXER_URL as string,
        process.env.SEQUENCE_PROJECT_ACCESS_KEY as string,
        process.env.BUILDER_API_SECRET_KEY as string
    )
}