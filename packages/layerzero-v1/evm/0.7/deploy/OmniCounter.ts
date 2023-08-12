import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { Stage, networkToStage } from '@layerzerolabs/lz-definitions'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()

    console.log(`OmniCounter.js deployer: ${layerzero}`)
    // to get deployment from mainnet even if fork
    const endpoint = await hre.ethers['getContract']('Endpoint')

    // console.log("Deploying OmniCounter with endpoint: ", endpoint.address)

    await deploy('OmniCounter', {
        from: layerzero,
        args: [endpoint.address],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    })
}

module.exports.skip = ({ network }) =>
    new Promise((resolve) => {
        resolve(network.name !== 'hardhat' && networkToStage(network.name) === Stage.MAINNET) // skip it when its mainnet for now
    })

module.exports.tags = ['OmniCounter', 'test']
// do not make this a dependency, it will cause a redeploy
module.exports.dependencies = ['Endpoint']
