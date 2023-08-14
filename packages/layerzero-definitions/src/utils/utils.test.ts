import { expect, test } from '@jest/globals'

import { Chain, ChainKey, ChainType, EndpointId, EndpointVersion, Environment, Stage } from '../enums'

import {
    chainAndStageToEndpointId,
    chainAndStageToNetwork,
    endpointIdToChainKey,
    endpointIdToNetwork,
    endpointIdToStage,
    getChainType,
    networkToEndpointId,
    networkToStage,
} from './utils'

describe('Utility', () => {
    // getChainType
    test.each([
        // Chain, ChainFamily
        [Chain.ETHEREUM, ChainType.EVM],
        [Chain.APTOS, ChainType.APTOS],
        ['__NON_EXIST__', ChainType.UNKNOWN],
    ])('getChainType(%s, %s)', (chain, chainType) => {
        const val = chain as Chain
        const rv = getChainType(val)
        expect(rv).toEqual(chainType)
    })

    // test chainAndStageToNetwork
    test.each([
        // Chain, Stage, Network
        [[Chain.ETHEREUM, Stage.MAINNET, EndpointVersion.V1], 'ethereum-mainnet'],
        [[Chain.ETHEREUM, Stage.MAINNET, EndpointVersion.V2], 'ethereum-mainnet'],
        [[Chain.ETHEREUM, Stage.MAINNET, EndpointVersion.V1, Environment.LOCAL], 'ethereum-mainnet-local'],
        [[Chain.ETHEREUM, Stage.MAINNET, EndpointVersion.V2, Environment.LOCAL], 'ethereum-mainnet-local'],
    ])('chainAndStageToNetwork(%s, %s)', (params, network) => {
        const valChain = params[0] as Chain
        const valStage = params[1] as Stage
        const valEnv = params.length > 3 ? (params[3] as Environment) : undefined
        const rv = chainAndStageToNetwork(valChain, valStage, valEnv)
        expect(rv).toEqual(network)
    })

    // test chainAndStageToEndpointId
    test.each([
        // Chain, Stage, EndpointId
        [[Chain.ETHEREUM, Stage.MAINNET, EndpointVersion.V1], EndpointId.ETHEREUM_MAINNET],
        [[Chain.ETHEREUM, Stage.MAINNET, EndpointVersion.V2], EndpointId.ETHEREUM_V2_MAINNET],
    ])('chainAndStageToEndpointId(%s, %s)', (params, endpointId) => {
        const valChain = params[0] as Chain
        const valStage = params[1] as Stage
        const valVersion = params[2] as unknown as EndpointVersion
        const rv = chainAndStageToEndpointId(valChain, valStage, valVersion)
        expect(rv).toEqual(endpointId)
    })

    // test endpointIdToStage
    test.each([
        // EndpointId, Stage
        [EndpointId.ETHEREUM_MAINNET, Stage.MAINNET],
        [EndpointId.ETHEREUM_V2_MAINNET, Stage.MAINNET],
    ])('endpointIdToStage(%s, %s)', (endpointId, stage) => {
        const rv = endpointIdToStage(endpointId)
        expect(rv).toEqual(stage)
    })

    // test networkToEndpointId
    test.each([
        ['bsc-sandbox', EndpointVersion.V1, EndpointId.BSC_SANDBOX],
        ['bsc-sandbox', EndpointVersion.V2, EndpointId.BSC_V2_SANDBOX],
    ])('networkToEndpointId(%s, %s, %s)', (network, version, endpointId) => {
        const rv = networkToEndpointId(network, version)
        expect(rv).toEqual(endpointId)
    })

    // test networkToStage
    test.each([
        ['bsc-sandbox', Stage.SANDBOX],
        ['bsc-sandbox-local', Stage.SANDBOX],
    ])('networkToStage(%s, %s)', (network, stage) => {
        const s = networkToStage(network)
        expect(s).toEqual(stage)
    })

    // test endpointIdToNetwork
    test.each([
        [EndpointId.BSC_SANDBOX, Environment.LOCAL, 'bsc-sandbox-local'],
        [EndpointId.BSC_SANDBOX, Environment.MAINNET, 'bsc-sandbox'],
        [EndpointId.BSC_SANDBOX, Environment.TESTNET, 'bsc-sandbox'],
        [EndpointId.BSC_SANDBOX, Environment.DEVNET, 'bsc-sandbox'],
        [EndpointId.BSC_SANDBOX, undefined, 'bsc-sandbox'],
    ])('endpointIdToNetwork(%s, %s, %s)', (endpointId, env, network) => {
        const rv = endpointIdToNetwork(endpointId, env)
        expect(rv).toEqual(network)
    })

    // test endpointIdToNetwork
    test.each([
        [EndpointId.ETHEREUM_SANDBOX, ChainKey.GOERLI],
        [EndpointId.ETHEREUM_MAINNET, ChainKey.ETHEREUM],
    ])('endpointIdToChainKey(%s, %s)', (endpointId, chainKey) => {
        const rv = endpointIdToChainKey(endpointId)
        expect(rv).toEqual(chainKey)
    })
})
