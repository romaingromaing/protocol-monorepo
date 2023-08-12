import * as fs from 'fs'

const hre = require('hardhat')
export function getPriceFeedV2Address(): string {
    if (hre.network.name === 'hardhat') {
        return hre.ethers.constants.AddressZero
    }
    const priceFeed = JSON.parse(
        fs
            .readFileSync(`../../../layerzero-v2/evm/sdk/deployments/${hre.network.name}/PriceFeed.json`, 'utf-8')
            .toString()
    )
    return priceFeed.address
}
