import invariant from 'tiny-invariant'

import { CHAIN_KEY, ENVIRONMENT, ULN_V1_CHAINS } from '../constants'
import { Chain, ChainKey, ChainType, EndpointId, EndpointVersion, Environment, Stage } from '../enums'

export function networkToEndpointId(network: string, version: EndpointVersion): number {
    const name = network.replace('-local', '')
    const [chain, stage] = name.split('-')

    const key =
        version === EndpointVersion.V1
            ? `${chain.toUpperCase()}_${stage.toUpperCase()}`
            : `${chain.toUpperCase()}_V2_${stage.toUpperCase()}`
    invariant(key in EndpointId, `Invalid network name: ${network}, key: ${key}`)
    return EndpointId[key as keyof typeof EndpointId] as EndpointId
}

export function networkToEnv(network: string, version: EndpointVersion): Environment {
    if (network.includes('local') || network === 'hardhat') {
        return Environment.LOCAL
    }
    const endpointId = networkToEndpointId(network, version)
    return ENVIRONMENT[endpointId as keyof typeof ENVIRONMENT]
}

export function networkToStage(network: string): Stage {
    const name = network.replace('-local', '')
    const stage = name.split('-')[1]
    return Stage[stage.toUpperCase() as keyof typeof Stage]
}

export function endpointIdToNetwork(endpointId: number, env?: Environment): string {
    const key = EndpointId[endpointId]
    invariant(key, `Invalid endpointId: ${endpointId}`)
    const network = key.toLowerCase().replace(/_/g, '-').replace('-v2', '')
    if (env === Environment.LOCAL) {
        return `${network}-local`
    }
    return network
}

export function endpointIdToVersion(endpointId: number): EndpointVersion {
    const key = EndpointId[endpointId]
    invariant(key, `Invalid endpointId: ${endpointId}`)
    return key.includes('V2') ? EndpointVersion.V2 : EndpointVersion.V1
}

export function endpointIdToChainKey(endpointId: number): ChainKey {
    const chainKey = CHAIN_KEY[endpointId as EndpointId]
    invariant(chainKey, `No ChainKey for EndpointId: ${endpointId}`)
    return chainKey
}

export function chainAndStageToEndpointId(chain: Chain, stage: Stage, version: EndpointVersion): EndpointId {
    const key =
        version === EndpointVersion.V2
            ? `${chain.toUpperCase()}_V2_${stage.toUpperCase()}`
            : `${chain.toUpperCase()}_${stage.toUpperCase()}`
    invariant(key in EndpointId, `Invalid key: ${key}`)
    return EndpointId[key as keyof typeof EndpointId] as EndpointId
}

//todo: change function to take boolean env
export function chainAndStageToNetwork(chain: Chain, stage: Stage, env?: Environment): string {
    if (env === Environment.LOCAL) {
        return `${chain}-${stage}-local`
    }
    return `${chain}-${stage}`
}

export function networkToChain(network: string): Chain {
    return network.split('-')[0] as Chain
}

export function networkToChainType(network: string): ChainType {
    const chain = networkToChain(network)
    return getChainType(chain)
}

/**
 * Returns the chain family for a given chain
 * @param chain
 */
export function getChainType(chain: Chain): ChainType {
    switch (chain) {
        case Chain.APTOS:
            return ChainType.APTOS
        case Chain.SOLANA:
            return ChainType.SOLANA
        default:
            if (Object.values(Chain).includes(chain)) {
                return ChainType.EVM
            } else {
                return ChainType.UNKNOWN
            }
    }
}

export function endpointIdToChain(endpointId: number): Chain {
    const key = EndpointId[endpointId]
    invariant(key, `Invalid endpointId: ${endpointId}`)
    return key.split('_')[0].toLowerCase() as Chain
}

export function endpointIdToStage(endpointId: number): Stage {
    let key = EndpointId[endpointId]
    invariant(key, `Invalid endpointId: ${endpointId}`)
    key = key.replace('_V2', '')
    return key.split('_')[1].toLowerCase() as Stage
}

export function endpointIdToChainType(endpointId: number): ChainType {
    const chain = endpointIdToChain(endpointId)
    return getChainType(chain)
}

export function getNetworksForStage(stage: Stage) {
    const networks: string[] = []
    for (const key in EndpointId) {
        if (Number(key) >= 0) {
            const network = endpointIdToNetwork(Number(key))
            const s = network.split('-')[1]
            if (stage === s) {
                networks.push(network)
            }
        }
    }
    return networks
}

const ULN_V1_BIAS = 100

export const getEndpointVersionForUlnVersion = (ulnVersion: string): EndpointVersion => {
    const [majorVerion, minorVersion, endpointVersion] = ulnVersion.split('.')
    if (!endpointVersion) {
        return EndpointVersion.V1
    }
    const version = {
        '1': EndpointVersion.V1,
        '2': EndpointVersion.V2,
    }[endpointVersion]
    if (!version) {
        throw new Error(`Invalid ulnVersion: ${ulnVersion}`)
    }
    return version
}

export function getChainIdForNetwork(chain: string, stage: string, ulnVersion: string): string {
    const endpointId = chainAndStageToEndpointId(
        chain as Chain,
        stage as Stage,
        getEndpointVersionForUlnVersion(ulnVersion)
    )
    return (ulnVersion == '1' ? endpointId - ULN_V1_BIAS : endpointId).toString()
}

export function getNetworkForChainId(targetchainId: number) {
    if (ULN_V1_CHAINS.includes(targetchainId + ULN_V1_BIAS)) {
        const endpointId = targetchainId + ULN_V1_BIAS
        const chain = endpointIdToChain(endpointId)
        const stage = networkToStage(endpointIdToNetwork(endpointId))
        return {
            chainName: chain,
            env: stage,
            ulnVersion: '1',
        }
    }
    const chain = endpointIdToChain(targetchainId)
    const stage = networkToStage(endpointIdToNetwork(targetchainId))
    return {
        chainName: chain,
        env: stage,
        ulnVersion: '2',
    }
}
