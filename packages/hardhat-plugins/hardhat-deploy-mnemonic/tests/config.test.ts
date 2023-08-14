import { describe, expect, test } from '@jest/globals'
import { HardhatUserConfig, extendConfig, extendEnvironment } from 'hardhat/config'
import { HardhatContext } from 'hardhat/internal/context'
import { HardhatConfig } from 'hardhat/types'
import _ from 'lodash'

import { overwriteNamedAccounts } from '../src/utils'

import { buildHardhatEnvironment, captureContext } from './utils'

describe('hardhat-deploy-mnemonic', () => {
    const modules = {}

    test.each([
        [
            {
                mnemonic: 'test test test test test test test test test test test junk',
                path: `m/44'/60'/0'/0/0`,
            },
            'privatekey://0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        ],
        [
            {
                mnemonic: 'test test test test test test test test test test test junk',
                path: `m/44'/60'/0'/0'/0'`,
            },
            'privatekey://0xf5265cc3ba1ffd60761c486e1226178b2eca593c5d139588e647e7eb3351dce6',
        ],
        [
            { address: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        ],
    ])(`mnemonic to privateKey %#`, async (setting, address) => {
        // networks and paths in the resolvedConfig is needed by the Environment constructor
        const _resolvedConfig = {
            networks: {
                hardhat: {},
            },
            paths: {
                artifacts: 'artifacts',
            },
            namedAccounts: {
                deployer: {
                    default: 0,
                },
                proxyOwner: {
                    default: 1,
                },
            },
        }
        const _userConfig = {
            mnemonics: {
                deployer: setting,
            },
        }

        const unleashContext = captureContext()
        try {
            const ctx = HardhatContext.createHardhatContext()

            extendConfig((resolvedConfig: HardhatConfig, userConfig: HardhatUserConfig) => {
                _.merge(resolvedConfig, _resolvedConfig)
                _.merge(userConfig, _userConfig)
            })

            extendEnvironment((env) => {
                overwriteNamedAccounts(env.config, env.userConfig)
            })

            const env = buildHardhatEnvironment(ctx, 'hardhat')

            const expected = {
                namedAccounts: {
                    deployer: address,
                    proxyOwner: {
                        default: 1,
                    },
                },
            }

            // @ts-ignore
            expect(env.config.namedAccounts).toEqual(expected.namedAccounts)
        } finally {
            unleashContext()
        }
    })
})
