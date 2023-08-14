import 'dotenv/config'
import * as fs from 'fs'

import {
    ChainType,
    ENVIRONMENT,
    EndpointId,
    Environment,
    Stage,
    endpointIdToNetwork,
    networkToChain,
    networkToStage,
} from '@layerzerolabs/lz-definitions'
import { Key, evmKeyUtils, keyUtils } from '@layerzerolabs/monorepo-utilities'

// example: MNEMONIC=xxx, MNEMONIC_ETHEREUM=xxx
export function getMnemonic(network?: string) {
    if (network) {
        const mnemonic = process.env['MNEMONIC_' + network.toUpperCase()]
        if (mnemonic && mnemonic !== '') {
            return mnemonic
        }
    }

    const mnemonic = process.env.MNEMONIC
    if (!mnemonic || mnemonic === '') {
        return 'test test test test test test test test test test test junk'
    }
    return mnemonic
}

// e.g. ETHEREUM_TESTNET for MNEMONIC_ETHEREUM_TESTNET
export function accounts(endpointKey?: string) {
    return { mnemonic: getMnemonic(endpointKey) }
}

export function evmPrivateKeysFromKeys(stage: Stage) {
    const keys = keyUtils.getKeys(stage, ChainType.EVM)
    if (!keys) {
        return []
    }
    const pks = Object.keys(keys).map((name) => {
        const key = evmKeyUtils.getKey(stage, name)
        if (key.pk) {
            return key.pk
        }
        const wallet = evmKeyUtils.getChainWallet(stage, name)
        return wallet.privateKey
    })
    return pks
}

export function getNetworks(): { [network: string]: any } {
    const nodeFilePath = require.resolve('@layerzerolabs/runtime-config/node-url.json')
    const urls = JSON.parse(fs.readFileSync(nodeFilePath, 'utf8'))

    const networks: { [network: string]: any } = {}
    for (const endpointKey in EndpointId) {
        if (Number(endpointKey) >= 0) {
            const network = endpointIdToNetwork(parseInt(endpointKey))

            const stage = networkToStage(network)
            let accounts = keyUtils.getKey(stage, ChainType.EVM, 'default')
            if (accounts === undefined) {
                accounts = { mnemonic: 'test test test test test test test test test test test junk' }
            }

            const chain = networkToChain(network)
            const env = ENVIRONMENT[endpointKey as unknown as EndpointId]
            const url = urls[env][chain]
            if (url && !(network in networks)) {
                networks[network] = {
                    accounts,
                    url,
                }
            }

            const localUrl = urls[Environment.LOCAL][chain]
            if (localUrl && !(`${network}-local` in networks)) {
                networks[`${network}-local`] = {
                    url: localUrl,
                }
            }
        }
    }
    return networks
}

export function getMnemonics(stage: string | undefined) {
    if (stage === undefined) {
        return {}
    }
    const keys = keyUtils.getKeys(stage as Stage, ChainType.EVM)
    const mnemonics: { [name: string]: Key } = {}
    for (const name in keys) {
        const key = keyUtils.getKey(stage as Stage, ChainType.EVM, name)
        if (key) {
            mnemonics[name] = key
        }
    }
    return {
        mnemonics: mnemonics,
    }
}

export function isLocalhost(network: string): boolean {
    return network === 'localhost' || network === 'hardhat'
}
