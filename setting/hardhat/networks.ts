import { accounts, getNetworks } from './utils'

export const hardhatNetworks = {
    networks: {
        localhost: {
            url: 'http://127.0.0.1:8545',
            accounts: accounts(),
        },
        hardhat: {
            accounts: accounts(),
            blockGasLimit: 30_000_000,
            throwOnCallFailures: false,
        },
        ...getNetworks(),
    },
}
