import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { isLocalhost } from '@layerzerolabs/hardhat-config'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()

    console.log(layerzero)
    await deploy('Token', {
        from: layerzero,
        log: true,
    })
}

module.exports.skip = ({ network }) =>
    new Promise((resolve) => {
        resolve(!isLocalhost(network.name)) // skip it when its mainnet for now
    })

module.exports.tags = ['Token', 'test', 'alt-token']
