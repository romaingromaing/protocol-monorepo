import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { BRIDGE_ADDRESS, EndpointVersion, STG_ADDRESS, networkToEndpointId } from '@layerzerolabs/lz-definitions'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()

    const endpointId = hre.network.name === 'hardhat' ? 1 : networkToEndpointId(hre.network.name, EndpointVersion.V1)

    const bridgeAddr = BRIDGE_ADDRESS[endpointId] || hre.ethers.constants.AddressZero
    const stgAddr = STG_ADDRESS[endpointId] || hre.ethers.constants.AddressZero

    console.log(`Network: ${hre.network.name}`)
    console.log(`Stargate Bridge Address: ${bridgeAddr}`)
    console.log(`Stargate Address: ${stgAddr}`)
    console.log(`Endpoint ID: ${endpointId}`)

    await deploy('FPValidator', {
        from: layerzero,
        // gasPrice: '2000000000',
        args: [bridgeAddr, stgAddr],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    })
}

module.exports.tags = ['FPValidator', 'test']
