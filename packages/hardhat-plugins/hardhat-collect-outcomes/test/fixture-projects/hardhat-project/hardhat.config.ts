// We load the plugin here.
import 'hardhat-deploy'
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import { HardhatUserConfig } from 'hardhat/types'

import '../../../src/index'

const config: HardhatUserConfig = {
    solidity: '0.7.6',
    defaultNetwork: 'hardhat',
    networks: {
        ethereum: {
            url: 'http://localhost:8501',
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        proxyOwner: {
            default: 1,
        },
    },
    paths: {
        cache: 'cache',
        artifacts: `artifacts`,
        sources: 'contracts',
        tests: 'tests',
        deploy: 'deploy',
        deployments: `deployments`,
        collects: {
            artifacts: {
                target: 'official/artifacts',
                patterns: ['contracts/!(mocks)/**/+([a-zA-Z0-9_]).json'],
            },
            deployments: {
                target: 'official/deployments',
                patterns: ['**/!(solcInputs)/*.json'],
            },
        },
    },
    typechain: {
        outDir: 'src/typechain-types',
        target: 'ethers-v5',
        artifacts: ['artifacts/contracts/?(Hello|World).sol/+([a-zA-Z0-9_]).json'],
        alwaysGenerateOverloads: false,
        dontOverrideCompile: false,
    },
}

export default config
