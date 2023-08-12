import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()

    await deploy('FeeHandler', {
        from: layerzero,
        args: [],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ['FeeHandler', 'test', 'alt-token']
