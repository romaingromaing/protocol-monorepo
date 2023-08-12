import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { layerzero } = await hre.getNamedAccounts()
    // @ts-expect-error TS2551
    const endpoint = await hre.ethers['getContract']('Endpoint')

    await deploy('NonceContract', {
        // gasLimit: 30000000,
        from: layerzero,
        args: [endpoint.address],
        log: true,
        waitConfirmations: 1,
    })
}

// module.exports.skip = () =>
//     new Promise(async (resolve) => {
//         resolve(!isTestnet()) // skip it when its mainnet for now
//     })

module.exports.tags = ['NonceContract', 'test', 'v2']
module.exports.dependencies = ['Endpoint']
