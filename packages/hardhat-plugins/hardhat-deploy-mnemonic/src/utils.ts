import { ethers } from 'ethers'
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types/config'

import './type-extensions'

export function overwriteNamedAccounts(config: HardhatConfig, userConfig: HardhatUserConfig) {
    // only apply if the hardhat-deploy plugin is enabled
    if ('namedAccounts' in config === false) {
        return
    }

    if ('mnemonics' in userConfig === false) {
        return
    }

    // @ts-ignore
    const { mnemonics = {} } = userConfig

    // `config.namedAccounts = userConfig.namedAccounts;` in the hardhat-deploy plugin
    // and userConfig is freezed by deepFreezeUserConfig in hardhat,
    // so changing the value of config.namedAccounts directly will cause error HH10.
    // it can be fixed by copying the value of config.namedAccounts to a new object.
    const result: Record<string, string> = {}

    for (const key in mnemonics) {
        const setting = mnemonics[key]
        if ('mnemonic' in setting) {
            const wallet = ethers.Wallet.fromMnemonic(setting.mnemonic!, setting.path)
            result[key] = 'privatekey://' + wallet.privateKey
        } else if ('address' in setting) {
            result[key] = setting.address!
        }
    }

    // @ts-ignore
    config.namedAccounts = result
}
