import { AptosAccount, HexString } from 'aptos'
import invariant from 'tiny-invariant'

import { ChainType, Stage } from '@layerzerolabs/lz-definitions'

import { Key } from '../model'
import * as keyUtils from '../utils'

let accounts: { [stage in Stage]: { [name: string]: AptosAccount } }

export function getKey(stage: Stage, name: string): Key {
    return keyUtils.mustGetKey(stage, ChainType.APTOS, name)
}

export function getKeys(stage: Stage): { [name: string]: Key | string } {
    return keyUtils.mustGetKeys(stage, ChainType.APTOS)
}

export function getChainWallet(stage: Stage, name: string): AptosAccount {
    if (accounts && accounts[stage] && accounts[stage][name]) {
        return accounts[stage][name]
    }
    const key = getKey(stage, name)

    let account: AptosAccount | undefined
    if (key.pk) {
        account = getAccountByPrivateKey(key.pk)
    } else if (key.mnemonic) {
        account = getAccount(key.mnemonic, key.path)
    } else {
        throw Error(`No key found for ${stage} ${name}`)
    }

    // save keyPari to accounts
    if (!accounts) {
        accounts = {} as any
    }
    const stageAccounts = (accounts[stage] ||= {} as any)
    stageAccounts[name] = account
    if (key.address) {
        invariant(
            account.address().toString() === key.address,
            `Aptos address mismatch: [${stage}, ${name}] ${account.address().toString()} !== ${key.address}`
        )
    }
    return account
}

export function getAccount(mnemonic: string, path = "m/44'/637'/0'/0'/0'"): AptosAccount {
    return AptosAccount.fromDerivePath(path, mnemonic)
}
export function getAccountByPrivateKey(privateKey: string): AptosAccount {
    const privateKeyBytes = HexString.ensure(privateKey).toUint8Array()
    return new AptosAccount(privateKeyBytes)
}
