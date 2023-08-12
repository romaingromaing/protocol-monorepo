import { ethers } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import invariant from 'tiny-invariant'

import { EndpointVersion, networkToEndpointId } from '@layerzerolabs/lz-definitions'

import { deployContract, getZksyncDeployerFromMnemonics } from './helper'

//todo: investigate if we can merge zksync deploy into ops deploy

export default async function (hre: HardhatRuntimeEnvironment) {
    const mnemonics = hre.userConfig.mnemonics
    if (!mnemonics) {
        throw new Error('mnemonics not found')
    }
    const network = hre.network.name
    const deploymentsFolder = `${hre.config.paths.deployments}/${network}`
    console.log(`deploymentsFolder: ${deploymentsFolder}`)

    invariant(hre.network.name === network, `network mismatch: ${hre.network} != ${network}`)

    const layerzeroDeployer = getZksyncDeployerFromMnemonics(hre, mnemonics, 'layerzero')
    console.log(`deployer: ${layerzeroDeployer.zkWallet.address}`)

    const endpointId = networkToEndpointId(network, EndpointVersion.V1)
    const endpoint = await deployContract(layerzeroDeployer, 'Endpoint', [endpointId], deploymentsFolder)
    await deployContract(
        layerzeroDeployer,
        'FPValidator',
        [ethers.constants.AddressZero, ethers.constants.AddressZero],
        deploymentsFolder
    )
    const nonce = await deployContract(layerzeroDeployer, 'NonceContract', [endpoint.address], deploymentsFolder)
    const uln = await deployContract(
        layerzeroDeployer,
        'UltraLightNodeV2',
        [endpoint.address, nonce.address, endpointId],
        deploymentsFolder
    )
    await deployContract(layerzeroDeployer, 'TreasuryV2', [uln.address], deploymentsFolder)
}
