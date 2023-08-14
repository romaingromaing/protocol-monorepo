import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()

    const ultraLightNodeV2 = await hre.deployments.get('UltraLightNodeV2')

    await deploy('TreasuryV2', {
        gasPrice: '20000000000',
        from: layerzero,
        args: [ultraLightNodeV2.address],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    })
}

module.exports.tags = ['TreasuryV2', 'test', 'v2']
module.exports.dependencies = ['UltraLightNodeV2']
