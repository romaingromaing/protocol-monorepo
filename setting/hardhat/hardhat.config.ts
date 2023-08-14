import '@nomiclabs/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-web3'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import 'hardhat-gas-reporter'
import 'hardhat-contract-sizer'
import 'hardhat-spdx-license-identifier'
import 'solidity-coverage'
import { HardhatUserConfig } from 'hardhat/config'

import '@layerzerolabs/hardhat-deploy-mnemonic'

export * from './networks'
export * from './utils'

const DEFAULT_PROVIDER_URL = 'http://127.0.0.1:8545/'

const config: HardhatUserConfig = {
    networks: {
        evm: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            url: process.env.NETWORK_URL ?? DEFAULT_PROVIDER_URL,
        },
    },
    defaultNetwork: 'hardhat',
    //@ts-ignore
    gasReporter: {
        currency: 'USD',
        enabled: process.env.REPORT_GAS === 'true',
        excludeContracts: ['contracts/libraries/'],
    },
    mocha: {
        timeout: 50000,
    },
    solidity: {
        compilers: [
            {
                version: '0.7.6',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 20000,
                    },
                },
            },
            {
                version: '0.8.19',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 20000,
                    },
                },
            },
        ],
    },
    etherscan: {
        apiKey: {
            // ethereum
            mainnet: process.env.ETHERSCAN_API_KEY || '',
            rinkeby: process.env.ETHERSCAN_API_KEY || '',
            // binance smart chain
            bsc: process.env.BSCSCAN_API_KEY || '',
            bscTestnet: process.env.BSCSCAN_API_KEY || '',
            // fantom mainnet
            opera: process.env.FTMSCAN_API_KEY || '',
            ftmTestnet: process.env.FTMSCAN_API_KEY || '',
            // optimism
            optimisticEthereum: process.env.OPTIMISMSCAN_API_KEY || '',
            optimisticKovan: process.env.OPTIMISMSCAN_API_KEY || '',
            // polygon
            polygon: process.env.POLYGONSCAN_API_KEY || '',
            polygonMumbai: process.env.POLYGONSCAN_API_KEY || '',
            // arbitrum
            arbitrumOne: process.env.ARBISCAN_API_KEY || '',
            arbitrumTestnet: process.env.ARBISCAN_API_KEY || '',
            // avalanche
            avalanche: process.env.SNOWTRACE_API_KEY || '',
            avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || '',
            // moonbeam
            moonbeam: process.env.MOONBEAM_API_KEY || '',
            moonbaseAlpha: process.env.MOONBEAM_API_KEY || '',
        },
    },
    spdxLicenseIdentifier: {
        overwrite: true,
        runOnCompile: true,
    },
}

export default config
