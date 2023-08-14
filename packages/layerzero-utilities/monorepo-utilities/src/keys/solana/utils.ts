import { Keypair } from '@solana/web3.js'
import invariant from 'tiny-invariant'

import { ChainType, Stage } from '@layerzerolabs/lz-definitions'

import { privateKeyFromDerivePath } from '..'
import { Key } from '../model'
import * as keyUtils from '../utils'

let keyPairs: { [stage in Stage]: { [name: string]: Keypair } }

export function getKey(stage: Stage, name: string): Key {
    return keyUtils.mustGetKey(stage, ChainType.SOLANA, name)
}

export function getKeys(stage: Stage): { [name: string]: Key | string } {
    return keyUtils.mustGetKeys(stage, ChainType.SOLANA)
}

export function getChainWallet(stage: Stage, name: string): Keypair {
    if (keyPairs && keyPairs[stage] && keyPairs[stage][name]) {
        return keyPairs[stage][name]
    }
    const key = getKey(stage, name)
    invariant(key.mnemonic, `No mnemonic found for ${stage} ${name}`)

    const keyPair = getKeypair(key.mnemonic, key.path)
    // save keyPari to keyPairs
    if (!keyPairs) {
        keyPairs = {} as any
    }
    const stagePairs = (keyPairs[stage] ||= {} as any)
    stagePairs[name] = keyPair
    if (key.address) {
        invariant(
            keyPair.publicKey.toString() === key.address,
            `Solana address mismatch: [${stage}, ${name}] ${keyPair.publicKey.toString()} !== ${key.address}`
        )
    }
    return keyPair
}

function getKeypair(mnemonic: string, path = "m/44'/501'/0'/0'"): Keypair {
    return Keypair.fromSeed(privateKeyFromDerivePath(mnemonic, path))
}
