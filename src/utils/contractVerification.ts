import { ETHERSCAN_V2_API } from "../constants/general";
import { type ContractInputMetadata } from "../types/contract";

type VerifyContractParams = {
    chainId: string;
    contractAddress: string;
    contractName: string;
    compilerVersion: string;
    contractInputMetadata: ContractInputMetadata;
    isOptimizationUsed?: boolean;
    constructorArguments?: string;
}

export const verifyContract = async (params: VerifyContractParams) => {
    const { chainId, contractAddress, contractName, compilerVersion, constructorArguments, isOptimizationUsed, contractInputMetadata } = params;

    const formData = new FormData();
    formData.append('codeformat', 'solidity-standard-json-input');
    formData.append('sourceCode', JSON.stringify(contractInputMetadata));
    formData.append('contractaddress', contractAddress);
    formData.append('contractname', contractName);
    formData.append('compilerversion', compilerVersion);
    formData.append('chainid', chainId);

    if (isOptimizationUsed) {
        formData.append('optimizationused', '1');
    }

    if(constructorArguments) {
        formData.append('constructorArguements', constructorArguments);
    }

    console.log(formData);

    const response = await fetch(`${ETHERSCAN_V2_API}?chainid=${chainId}&module=contract&action=verifysourcecode&apikey=${process.env.ETHERSCAN_API_KEY}`, {
        method: 'POST',
        body: formData,
    })
        .then(res => res.json())
        .catch(console.error);

    return response;
}

/**
 * Extracts the first source file from the sources object and returns it in the format "contract/{name.sol}:{name}".
 * @param sources The sources object from the contract JSON input.
 * @returns The formatted string or undefined if not found.
 */
export const getContractName = (contractInputMetadata: ContractInputMetadata): string => {
    const firstKey = Object.keys(contractInputMetadata.sources)[0];

    // Match "contracts/{name}.sol"
    const match = firstKey.match(/^contracts\/([^/]+\.sol)$/);

    const fileName = match![1]; // e.g., "MyToken.sol"
    const name = fileName.replace('.sol', ''); // e.g., "MyToken"
    return `contract/${fileName}:${name}`;
};