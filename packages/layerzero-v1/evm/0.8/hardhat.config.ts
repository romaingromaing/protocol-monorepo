import * as path from 'path'

import '@matterlabs/hardhat-zksync-deploy'
import '@matterlabs/hardhat-zksync-solc'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-web3'
import 'dotenv/config'

import { HardhatUserConfig } from 'hardhat/types'
import 'hardhat-deploy'
import '@layerzerolabs/hardhat-zksync-collect-outcomes'

import { accounts, hardhatConfig, hardhatMnemonics } from '@layerzerolabs/hardhat-config'

const config: HardhatUserConfig = {
    ...hardhatConfig,
    paths: {
        cache: 'hh-cache',
        artifacts: 'artifacts',
        sources: 'contracts',
        tests: 'test',
        deploy: 'deploy',
        deployments: 'deployments',
        collects: {
            deployments: {
                source: `deployments`,
                target: `${path.dirname(require.resolve('@layerzerolabs/lz-evm-sdk-v1/package.json'))}/deployments`,
                patterns: ['**/!(solcInputs)/*.json'],
            },
        },
    },
    zksolc: {
        version: '1.3.1',
        compilerSource: 'binary',
        settings: {},
    },
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            accounts: accounts(),
        },
        'zksync-mainnet': {
            url: 'https://zksync2-mainnet.zksync.io',
            ethNetwork: 'https://eth-mainnet.public.blastapi.io', // Can also be the RPC URL of the Ethereum network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
            zksync: true,
        },
        'zksync-testnet': {
            url: 'https://testnet.era.zksync.dev', // URL of the zkSync network RPC
            ethNetwork: 'goerli', // Can also be the RPC URL of the Ethereum network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
            zksync: true,
        },
        'zksync-testnet-local': {
            ethNetwork: 'http://127.0.0.1:8545',
            url: 'http://127.0.0.1:3050', // URL of the zkSync network RPC
            zksync: true,
        },
    },
    solidity: {
        version: '0.8.17',
        settings: {
            optimizer: {
                enabled: true,
                runs: 30000,
            },
        },
    },
    ...hardhatMnemonics,
}

export default config
