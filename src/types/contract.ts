import type { InterfaceAbi } from "ethers";

export type Contract = {
    id: number;
    projectId?: number;
    contractName: string;
    contractAddress: string;
    contractType?: string;
    chainId: number;
    source?: string;
    itemsContractAddress?: string;
    splitterContractAddresses?: string[];
    abi?: InterfaceAbi;
    bytecode: string;
    bytecode_hash: string;
    audienceId?: number | null;
    symbol?: string;
    createdAt: string;
    updatedAt: string;
}

// For contract verification

// Type for the optimizer settings
type OptimizerSettings = {
    enabled: boolean;
    runs: number;
};

// Type for output selection mapping
type OutputSelection = {
    [fileGlob: string]: {
        [contractName: string]: string[];
    };
};

// Type for the settings object
type ContractSettings = {
    optimizer: OptimizerSettings;
    outputSelection: OutputSelection;
    remappings: string[];
};

// Type for a single source file entry
type SourceCodeFile = {
    content: string;
};

// Type for the sources object
type SourceCodeContent = {
    [fileName: string]: SourceCodeFile;
};

export type ContractInputMetadata = {
    language: string;
    settings: ContractSettings;
    sources: SourceCodeContent;
};