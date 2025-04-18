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
