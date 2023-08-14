import { mnemonicToSeedSync } from 'bip39'
import { derivePath } from 'ed25519-hd-key'

export * from './model'
export * as keyUtils from './utils'
export * as evmKeyUtils from './evm/utils'
export * as solanaKeyUtils from './solana/utils'
export * as aptosKeyUtils from './aptos/utils'

export function privateKeyFromDerivePath(mnemonic: string, path: string): Uint8Array {
    const normalizeMnemonic = mnemonic
        .trim()
        .split(/\s+/)
        .map((part) => part.toLowerCase())
        .join(' ')
    const seed = mnemonicToSeedSync(normalizeMnemonic)
    const { key } = derivePath(path, seed.toString('hex'))
    return new Uint8Array(key)
}
