import * as fs from 'fs'

import * as yaml from 'js-yaml'
import invariant from 'tiny-invariant'

import { ChainType, Stage } from '@layerzerolabs/lz-definitions'

import { Key } from './model'

let keys: { [stage in Stage]: { [chainType in ChainType]: { [name: string]: Key | string } } } | undefined

export function getKey(stage: Stage, chainType: ChainType, name: string): Key | undefined {
    const keys = getKeys(stage, chainType)
    if (!keys) {
        return undefined
    }

    const key = keys[name]
    if (typeof key === 'string') {
        return { mnemonic: key }
    } else {
        return key
    }
}

export function getKeys(stage: Stage, chainType: ChainType): { [name: string]: Key | string } | undefined {
    if (!keys) {
        const filePath = require.resolve('@layerzerolabs/runtime-config/keys.yaml')
        const content = fs.readFileSync(filePath, 'utf8')
        keys = yaml.load(content) as
            | { [stage in Stage]: { [chainType in ChainType]: { [name: string]: Key | string } } }
            | undefined
    }
    if (!keys || !keys[stage] || !keys[stage][chainType]) {
        return undefined
    }

    return keys[stage][chainType]
}

export function mustGetKey(stage: Stage, chanType: ChainType, name: string): Key {
    const key = getKey(stage, chanType, name)
    invariant(key, `No key found for ${stage} ${chanType} ${name}`)
    return key
}

export function mustGetKeys(stage: Stage, chanType: ChainType): { [name: string]: Key | string } {
    const keys = getKeys(stage, chanType)
    invariant(keys, `No keys found for ${stage} ${chanType}`)
    return keys
}
