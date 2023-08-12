import { HardhatRuntimeEnvironment } from 'hardhat/types'
import invariant from 'tiny-invariant'

import {
    deployContract,
    deployContractViaProxy,
    getZksyncDeployerFromMnemonics,
    getZksyncWalletFromMnemonics,
    readDeployment,
} from './helper'
import { getPriceFeedV2Address } from '../utils'

export default async function (hre: HardhatRuntimeEnvironment) {
    const mnemonics = hre.userConfig.mnemonics
    if (!mnemonics) {
        throw new Error('mnemonics not found')
    }
    const network = hre.network.name
    const deploymentsFolder = `${hre.config.paths.deployments}/${network}`
    console.log(`deploymentsFolder: ${deploymentsFolder}`)

    invariant(hre.network.name === network, `network mismatch: ${hre.network} != ${network}`)

    const proxyAdminWallet = getZksyncWalletFromMnemonics(mnemonics, 'proxyAdmin')

    console.log(`proxy owner: ${proxyAdminWallet.address}`)

    const relayerDeployer = getZksyncDeployerFromMnemonics(hre, mnemonics, 'relayer')
    console.log(`relayerWalletAddr: ${relayerDeployer.zkWallet.address}`)

    // deploy proxy and relayer
    const proxyAdminContract = await deployContract(
        relayerDeployer,
        'ProxyAdmin',
        [proxyAdminWallet.address],
        deploymentsFolder,
        'DefaultProxyAdmin'
    )

    const ulnDeploymentData = readDeployment(deploymentsFolder, 'UltraLightNodeV2')
    const priceFeedAddr = getPriceFeedV2Address()

    //todo: skip if relayer already deploy, should be using proxy-update instead
    await deployContractViaProxy(
        relayerDeployer,
        proxyAdminWallet,
        'RelayerV2',
        proxyAdminContract.address,
        {
            initialize: [ulnDeploymentData.address, priceFeedAddr],
            onUpgrade: [priceFeedAddr],
        },
        deploymentsFolder
    )
}
