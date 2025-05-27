import { SequenceIndexer } from "@0xsequence/indexer";

export const indexerClient = new SequenceIndexer(process.env.INDEXER_URL ?? "", process.env.PROJECT_ACCESS_KEY, process.env.BUILDER_API_SECRET_KEY)

export const TENDERLY_SIMULATION_URL = `https://api.tenderly.co/api/v1/account/${process.env.TENDERLY_ACCOUNT_SLUG}/project/${process.env.TENDERLY_PROJECT_SLUG}/simulate`