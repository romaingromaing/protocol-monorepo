import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { relayer, proxyAdmin } = await hre.getNamedAccounts()

    const ultraLightNodeV2 = await hre.deployments.get('UltraLightNodeV2AltToken')
    const priceFeed = await hre.deployments.get('PriceFeed')

    await deploy('RelayerV2', {
        from: relayer,
        log: true,
        waitConfirmations: 1,
        // skipIfAlreadyDeployed: true, // if you set to true, it cant/wont upgrade
        proxy: {
            owner: proxyAdmin,
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                init: {
                    methodName: 'initialize',
                    args: [ultraLightNodeV2.address, priceFeed.address],
                },
            },
        },
    })
}

module.exports.tags = ['RelayerV2AltToken', 'test', 'alt-token']
module.exports.dependencies = ['UltraLightNodeV2AltToken', 'PriceFeed']
