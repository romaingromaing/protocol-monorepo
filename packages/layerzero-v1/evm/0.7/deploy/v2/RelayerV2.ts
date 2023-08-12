import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { EndpointVersion, networkToEndpointId } from '@layerzerolabs/lz-definitions'

import { getPriceFeedV2Address } from '../utils'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { relayer, proxyAdmin } = await hre.getNamedAccounts()

    const ultraLightNodeV2 = await hre.deployments.get('UltraLightNodeV2')
    const priceFeedAddr = getPriceFeedV2Address()

    console.log(`[${hre.network.name}] PriceFeed Address: ${priceFeedAddr}`)

    let gasLimit = 5242880 // arcana-testnet is the lowest ive seen @ 5242880 block gasLimit
    const endpointId = hre.network.name === 'hardhat' ? 1 : networkToEndpointId(hre.network.name, EndpointVersion.V1)
    if ([10010, 20010].includes(endpointId)) {
        gasLimit = 30000000 // arbitrum requires >8m
    } else if (hre.network.name.includes('swimmer')) {
        gasLimit = 2000000
    }

    await deploy('RelayerV2', {
        from: relayer,
        // gasPrice: '1000000000',
        // gasPrice: hre.ethers.utils.parseUnits('0.01', 'gwei'),
        log: true,
        waitConfirmations: 1,
        // skipIfAlreadyDeployed: true, // if you set to true, it cant/wont upgrade
        proxy: {
            owner: proxyAdmin,
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                init: {
                    methodName: 'initialize',
                    args: [ultraLightNodeV2.address, priceFeedAddr],
                },
                onUpgrade: {
                    methodName: 'onUpgrade',
                    args: [priceFeedAddr],
                },
            },
        },
    })
}

module.exports.tags = ['RelayerV2', 'test', 'v2']
module.exports.dependencies = ['UltraLightNodeV2']
