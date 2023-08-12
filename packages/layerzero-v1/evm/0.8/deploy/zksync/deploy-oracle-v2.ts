import * as path from 'path'

import { HardhatRuntimeEnvironment } from 'hardhat/types'
import invariant from 'tiny-invariant'

import { Stage, networkToStage } from '@layerzerolabs/lz-definitions'

import { getPriceFeedV2Address } from '../utils'

import {
    deployContract,
    deployContractViaProxy,
    getZksyncDeployerFromMnemonics,
    getZksyncWalletFromMnemonics,
    readDeployment,
} from './helper'

//todo: investigate if we can merge zksync deploy into ops deploy

export const MULTI_SIG_ORACLE_SIGNERS = {
    [Stage.SANDBOX]: [
        '0x2F86126e74Ea110eCa56fDE6Aa1830f890593069', // d2-1
        '0x90A12916a7B611831B86C7c8C916D57382d72108', // d2-2
    ],
    [Stage.TESTNET]: ['0xb733B99F0f9b690C47004A835CA25e32992194DF', '0xbE25c1dd013979e10e6628CAeb707686DD1f73e3'],
    [Stage.MAINNET]: ['0x1A8ed0D3Ad42c9019CC141aAce7e5Fb6E576B917', '0x6eCe61d29b90642941C41240da924690da145696'],
}

export const MULTI_SIG_ORACLE_ADMIN = {
    [Stage.SANDBOX]: [
        '0x880F68A0Bc697be9389114D942ED3100Ca8B39AF', // essence
        '0xB9Cb228D7498d6F02B0F88F7b16d2Cf836d2aeA9', // for price updating
        '0x0a66ad3CBF27De2F6252d166f38eA8e8245A8C41', // alvin for testing
    ],
    [Stage.TESTNET]: [
        '0xc13b65f7c53Cd6db2EA205a4b574b4a0858720A6', // testnet deployer
        '0xEb6304c9904DC04eF66D367B2EBc41525d1F231b', // testnet essense execute()'er
        '0x0a66ad3CBF27De2F6252d166f38eA8e8245A8C41', // chip
    ],
    [Stage.MAINNET]: [
        '0xB8FF877ed78Ba520Ece21B1de7843A8a57cA47Cb', // essence
        // '0x339d413CCEfD986b1B3647A9cfa9CBbE70A30749', // for price updating
    ],
}

export const THRESHOLD = {
    [Stage.SANDBOX]: 1,
    [Stage.TESTNET]: 1,
    [Stage.MAINNET]: 2,
}

export default async function (hre: HardhatRuntimeEnvironment) {
    const network = hre.network.name
    const mnemonics = hre.userConfig.mnemonics
    const stage = networkToStage(network)

    if (!mnemonics) {
        throw new Error('mnemonics not found')
    }
    const deploymentsFolder = `${path.dirname(
        require.resolve('../../../../../../apps/oracle-tss/package.json')
    )}/deployments/${network}`
    console.log(`deploymentsFolder: ${deploymentsFolder}`)

    const ulnDeploymentsFolder = `${hre.config.paths.deployments}/${network}`
    console.log(`ulnDeploymentsFolder: ${ulnDeploymentsFolder}`)

    invariant(hre.network.name === network, `network mismatch: ${hre.network} != ${network}`)

    const oracleProxyAdminWallet = getZksyncWalletFromMnemonics(mnemonics, 'oracleProxyAdmin')
    console.log(`oracle proxy owner: : ${oracleProxyAdminWallet.address}`)

    const oracleDeployer = getZksyncDeployerFromMnemonics(hre, mnemonics, 'oracle')
    console.log(`deployer: ${oracleDeployer.zkWallet.address}`)

    const validatorSigners = MULTI_SIG_ORACLE_SIGNERS[stage]
    const admins = MULTI_SIG_ORACLE_ADMIN[stage]
    const threshold = THRESHOLD[stage]

    console.log(`validatorSigners: ${validatorSigners}`)
    console.log(`admins: ${admins}`)
    console.log(`threshold: ${threshold}`)

    // deploy proxy and relayer
    const proxyAdminContract = await deployContract(
        oracleDeployer,
        'ProxyAdmin',
        [oracleProxyAdminWallet.address],
        deploymentsFolder,
        'DefaultProxyAdmin'
    )
    const ulnDeploymentData = readDeployment(ulnDeploymentsFolder, 'UltraLightNodeV2')
    const priceFeedAddr = getPriceFeedV2Address()

    await deployContractViaProxy(
        oracleDeployer,
        oracleProxyAdminWallet,
        'OracleV2',
        proxyAdminContract.address,
        {
            initialize: [ulnDeploymentData.address, priceFeedAddr],
            onUpgrade: [ulnDeploymentData.address, priceFeedAddr, validatorSigners, threshold, admins],
        },
        deploymentsFolder
    )
}
