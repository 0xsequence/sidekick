import type { TenderlySimulatorUrlOptions } from "../../../../types/general";

export const getTenderlySimulationUrl = ({
    accountSlug,
    projectSlug,
    chainId,
    gas,
    gasPrice,
    value = "0",
    block,
    blockIndex,
    contractAddress,
    contractFunction,
    rawFunctionInput,
    functionInputs,
}: TenderlySimulatorUrlOptions): string => {
    const baseUrl = `https://dashboard.tenderly.co/${accountSlug}/${projectSlug}/simulator/new`;
    const params = new URLSearchParams({
        network: chainId.toString(),
        value: value.toString(),
    });

    if (rawFunctionInput) params.set("rawFunctionInput", rawFunctionInput);
    if (gas) params.set("gas", gas.toString());
    if (gasPrice) params.set("gasPrice", gasPrice.toString());
    if (block) params.set("block", block.toString());
    if (blockIndex) params.set("blockIndex", blockIndex.toString());
    if (contractAddress) params.set("contractAddress", contractAddress);
    if (contractFunction) params.set("contractFunction", contractFunction);
    if (functionInputs && functionInputs.length > 0) {
        params.set("functionInputs", JSON.stringify(functionInputs));
    }

    return `${baseUrl}?${params.toString()}`;
};