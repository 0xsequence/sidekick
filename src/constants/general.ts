import { SequenceIndexer } from "@0xsequence/indexer";

export const indexerClient = new SequenceIndexer(process.env.INDEXER_URL ?? "", process.env.PROJECT_ACCESS_KEY, process.env.BUILDER_API_SECRET_KEY)