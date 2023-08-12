import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { EndpointVersion, networkToEndpointId } from '@layerzerolabs/lz-definitions'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()

    // get the Endpoint address
    // @ts-expect-error TS2551
    const endpoint = await hre.ethers['getContract']('Endpoint')
    const localChainId = hre.network.name === 'hardhat' ? 1 : networkToEndpointId(hre.network.name, EndpointVersion.V1)
    // @ts-expect-error TS2551
    const nonceContract = await hre.ethers['getContract']('NonceContract')

    const { address } = await deploy('UltraLightNodeV2', {
        // gasLimit: 150000000, // for arbitrum, which requires unique gasLimit
        from: layerzero,
        args: [endpoint.address, nonceContract.address, localChainId],
        // if set it to true, will not attempt to deploy
        // even if the contract deployed under the same name is different
        skipIfAlreadyDeployed: true,
        log: true,
        waitConfirmations: 1,
    })
}

// module.exports.skip = () =>
//     new Promise(async (resolve) => {
//         resolve(!isTestnet()) // skip it when its mainnet for now
//     })

module.exports.tags = ['UltraLightNodeV2', 'test', 'v2']
module.exports.dependencies = ['Endpoint', 'NonceContract']
