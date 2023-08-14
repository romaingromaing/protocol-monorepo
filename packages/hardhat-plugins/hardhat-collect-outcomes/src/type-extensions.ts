// If your plugin extends types from another plugin, you should import the plugin here.

// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import 'hardhat/types/config'
import 'hardhat/types/runtime'

declare module 'hardhat/types/config' {
    // This is an example of an extension to one of the Hardhat config values.

    export interface CollectsArtifactsConfig {
        skip?: {
            zksync?: boolean
        }
        target: string
        patterns: string[]
    }
    export interface CollectsDeploymentsConfig {
        target: string
        patterns: string[]
    }
    export interface CollectsTypeChainConfig {
        target: string
        patterns: string[]
    }

    // We extend the UserConfig type, which represents the config as written
    // by the users. Things are normally optional here.
    export interface ProjectPathsUserConfig {
        collects?: {
            artifacts?: CollectsArtifactsConfig
            deployments?: CollectsDeploymentsConfig
            typechain?: CollectsTypeChainConfig
        }
    }

    // We also extend the Config type, which represents the configuration
    // after it has been resolved. This is the type used during the execution
    // of tasks, tests and scripts.
    // Normally, you don't want things to be optional here. As you can apply
    // default values using the extendConfig function.
    export interface ProjectPathsConfig {
        collects: {
            artifacts?: CollectsArtifactsConfig
            deployments?: CollectsDeploymentsConfig
            typechain?: CollectsTypeChainConfig
        }
    }
}

declare module 'hardhat/types/runtime' {
    // This is an example of an extension to the Hardhat Runtime Environment.
    // This new field will be available in tasks' actions, scripts, and tests.
    // export interface HardhatRuntimeEnvironment {
    // }

    export interface HardhatArguments {
        preprocessor?: string
    }
}
