import { HardhatRuntimeEnvironment } from 'hardhat/types'
import invariant from 'tiny-invariant'

import { deployContract, getZksyncDeployerFromMnemonics, readDeployment } from './helper'

export default async function (hre: HardhatRuntimeEnvironment) {
    const mnemonics = hre.userConfig.mnemonics
    if (!mnemonics) {
        throw new Error('mnemonics not found')
    }
    const network = hre.network.name
    const deploymentsFolder = `${hre.config.paths.deployments}/${network}`
    console.log(`deploymentsFolder: ${deploymentsFolder}`)

    invariant(hre.network.name === network, `network mismatch: ${hre.network} != ${network}`)

    const endpointDeployment = readDeployment(deploymentsFolder, 'Endpoint')
    console.log('Omnicounter: Using Endpoint address:', endpointDeployment.address)

    const counterDeployer = getZksyncDeployerFromMnemonics(hre, mnemonics, 'counter')
    await deployContract(counterDeployer, 'OmniCounter', [endpointDeployment.address], deploymentsFolder)
}
