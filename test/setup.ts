import 'dotenv/config'

const setup = () => {
    const chainId = '84532'
    const erc20ContractAddress = '0xC333a24E018caE739c984Fc0dbeFC8B62562d9Bf' // ERC20 contract address
    const erc721ContractAddress = '0x6e4081b3068aaD77Cb6327729439e6c4C414eb3E' // ERC721 contract address
    const engineSmartWallet = '0x796E42309E47D0239a3Ab1d39a6C55705CCb7046' 
    const recipient = '0xd3C85Fdd3695Aee3f0A12B3376aCD8DC54020549'
    const secretKey = process.env.SECRET_KEY as string

    return {
        chainId,
        erc20ContractAddress,
        erc721ContractAddress,
        engineSmartWallet,
        recipient,
        secretKey,
    }
}

export default setup