import '@nomiclabs/hardhat-web3'
import '@typechain/hardhat'
import 'dotenv/config'
import * as path from 'path'

import '@layerzerolabs/hardhat-collect-outcomes'
import { HardhatUserConfig } from 'hardhat/types'

import './tasks'

import { hardhatConfig, hardhatMnemonics, hardhatNetworks } from '@layerzerolabs/hardhat-config'

const SDK_DIR = path.dirname(require.resolve('../sdk/package.json'))
const config: HardhatUserConfig = {
    ...hardhatConfig,
    solidity: {
        compilers: [
            {
                version: '0.7.6',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 10000,
                    },
                },
            },
        ],
    },
    paths: {
        cache: 'hh-cache',
        artifacts: 'artifacts',
        sources: 'contracts',
        tests: 'test',
        deploy: 'deploy',
        deployments: 'deployments',
        collects: {
            artifacts: {
                target: `${SDK_DIR}/artifacts`,
                patterns: ['contracts/!(mocks)/**/+([a-zA-Z0-9_]).json'],
            },
            deployments: {
                target: `${SDK_DIR}/deployments`,
                patterns: ['**/!(solcInputs)/*.json'],
            },
        },
    },
    typechain: {
        outDir: 'src/typechain-types',
        target: 'ethers-v5',
        artifacts: [
            'artifacts/contracts/interfaces/?(IValidationLibraryHelper|IValidationLibraryHelperV2).sol/+([a-zA-Z0-9_]).json',
            'artifacts/contracts/?(UltraLightNode|UltraLightNodeV2|Relayer|RelayerV2|Endpoint).sol/+([a-zA-Z0-9_]).json',
        ],
        alwaysGenerateOverloads: false,
        dontOverrideCompile: false,
    },
    ...hardhatNetworks,
    ...hardhatMnemonics,
}

export default config
