import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { EndpointVersion, Environment, networkToEnv } from '@layerzerolabs/lz-definitions'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()

    const endpoint = await hre.ethers['getContract']('Endpoint')

    await deploy('UltraLightNode', {
        // gasLimit: 150000000, // for arbitrum, which requires unique gasLimit
        from: layerzero,
        args: [endpoint.address],
        // if set it to true, will not attempt to deploy
        // even if the contract deployed under the same name is different
        skipIfAlreadyDeployed: true,
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.skip = ({ network }) =>
    new Promise((resolve) => {
        const env = networkToEnv(network.name, EndpointVersion.V1)
        resolve(env !== Environment.LOCAL && network.name !== 'hardhat' && network.name !== 'localhost')
        // only use for tests
    })

module.exports.tags = ['UltraLightNode', 'test']
module.exports.dependencies = ['Endpoint']
