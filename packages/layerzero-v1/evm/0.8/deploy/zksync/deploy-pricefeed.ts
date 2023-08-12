import { HardhatRuntimeEnvironment } from 'hardhat/types'
import invariant from 'tiny-invariant'

import { Stage, networkToStage } from '@layerzerolabs/lz-definitions'

import {
    deployContract,
    deployContractViaProxy,
    getZksyncDeployerFromMnemonics,
    getZksyncWalletFromMnemonics,
} from './helper'

//todo: investigate if we can merge zksync deploy into ops deploy

const PRICE_UPDATER = {
    [Stage.SANDBOX]: '0x13B6B82D2f5E9b29fa453e3271cAB43Ced089800',
    [Stage.TESTNET]: '0xF5E8A439C599205C1aB06b535DE46681Aed1007a',
    [Stage.MAINNET]: '0x339d413CCEfD986b1B3647A9cfa9CBbE70A30749',
}
export default async function (hre: HardhatRuntimeEnvironment) {
    const mnemonics = hre.userConfig.mnemonics
    if (!mnemonics) {
        throw new Error('mnemonics not found')
    }
    const network = hre.network.name
    const deploymentsFolder = `${hre.config.paths.deployments}/${network}`
    console.log(`deploymentsFolder: ${deploymentsFolder}`)

    invariant(hre.network.name === network, `network mismatch: ${hre.network} != ${network}`)
    const stage = networkToStage(network)

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

    await deployContractViaProxy(
        relayerDeployer,
        proxyAdminWallet,
        'PriceFeed',
        proxyAdminContract.address,
        {
            initialize: [PRICE_UPDATER[stage]],
            onUpgrade: [],
        },
        deploymentsFolder
    )
}
