// If your plugin extends types from another plugin, you should import the plugin here.
// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import 'hardhat/types/config'
import 'hardhat/types/runtime'

export interface WorkspacesConfig {
    mnemonic: string
    [key: string]: string[] | string
}

// the accounts under the network
// namedAccounts

declare module 'hardhat/types/config' {
    export interface HardhatUserConfig {
        mnemonics?: {
            [name: string]: {
                mnemonic?: string
                path?: string
                address?: string
            }
        }
    }

    export interface HardhatConfig {}
}

declare module 'hardhat/types/runtime' {
    export interface HardhatRuntimeEnvironment {}
}
