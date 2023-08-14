import { Wallet, ethers } from 'ethers'
import invariant from 'tiny-invariant'

import { ChainType, Stage } from '@layerzerolabs/lz-definitions'

import { Key } from '../model'
import * as keyUtils from '../utils'

let wallets: { [stage in Stage]: { [name: string]: Wallet } }

export function getKey(stage: Stage, name: string): Key {
    return keyUtils.mustGetKey(stage, ChainType.EVM, name)
}

export function getKeys(stage: Stage): { [name: string]: Key | string } {
    return keyUtils.mustGetKeys(stage, ChainType.EVM)
}

export function getChainWallet(stage: Stage, name: string): Wallet {
    if (wallets && wallets[stage] && wallets[stage][name]) {
        return wallets[stage][name]
    }
    const key = getKey(stage, name)
    invariant(key.mnemonic, `No mnemonic found for ${stage} ${name}`)

    const wallet = ethers.Wallet.fromMnemonic(key.mnemonic, key.path)
    // save wallet to wallets
    if (!wallets) {
        wallets = {} as any
    }
    const stageWallets = (wallets[stage] ||= {} as any)
    stageWallets[name] = wallet
    if (key.address) {
        invariant(
            wallet.address === key.address,
            `EVM address mismatch: [${stage}, ${name}] ${wallet.address} !== ${key.address}`
        )
    }
    return wallet
}
