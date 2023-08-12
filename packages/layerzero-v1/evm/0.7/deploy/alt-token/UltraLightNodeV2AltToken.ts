import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { EndpointVersion, networkToEndpointId } from '@layerzerolabs/lz-definitions'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()
    const layerzeroSigner = await hre.ethers.getSigner(layerzero)

    // get the Endpoint address
    const endpoint = await hre.deployments.get('Endpoint')
    const localChainId = hre.network.name === 'hardhat' ? 1 : networkToEndpointId(hre.network.name, EndpointVersion.V1)

    const nonceContract = await hre.deployments.get('NonceContract')
    const feeHandler = await hre.ethers['getContract']('FeeHandler')

    const { address } = await deploy('UltraLightNodeV2AltToken', {
        from: layerzero,
        args: [endpoint.address, nonceContract.address, localChainId, feeHandler.address],
        skipIfAlreadyDeployed: true,
        log: true,
        waitConfirmations: 1,
    })

    await feeHandler.connect(layerzeroSigner).approve(address)
}

module.exports.tags = ['UltraLightNodeV2AltToken', 'test', 'v2']
module.exports.dependencies = ['FeeHandler', 'NonceContract']
