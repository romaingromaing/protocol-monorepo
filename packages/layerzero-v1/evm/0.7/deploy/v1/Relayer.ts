import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { relayer, proxyAdmin } = await hre.getNamedAccounts()

    console.log(`Deployer: ${relayer}`)
    console.log(`ProxyOwner: ${proxyAdmin}`)

    const ultraLightNode = await hre.deployments.get('UltraLightNode')

    // let gasLimit = 8000000
    // if ([10010, 20010].includes(getEndpointId())) {
    //     gasLimit = 30000000 // arbitrum requires >8m
    // }
    await deploy('Relayer', {
        // gasLimit,
        from: relayer,
        log: true,
        waitConfirmations: 1,
        // skipIfAlreadyDeployed: true,
        proxy: {
            owner: proxyAdmin,
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                init: {
                    methodName: 'initialize',
                    args: [ultraLightNode.address],
                },
            },
        },
    })
}

module.exports.skip = ({ network }) =>
    new Promise((resolve) => {
        resolve(!(network.name === 'hardhat')) // only use for tests
    })

module.exports.tags = ['Relayer', 'test']
module.exports.dependencies = ['UltraLightNode']
