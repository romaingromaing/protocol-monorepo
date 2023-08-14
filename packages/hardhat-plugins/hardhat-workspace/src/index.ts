import * as path from 'path'

import { HardhatUserConfig, extendConfig, extendEnvironment } from 'hardhat/config'
import { HardhatConfig } from 'hardhat/types'
import { EthereumProvider } from 'hardhat/types/provider'

// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import './type-extensions'
import { buildHardhatRuntimeEnvironmentForWorkspace, runInHardhatRuntimeEnvironment } from './utils'

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    // We apply our default config here. Any other kind of config resolution
    // or normalization should be placed here.
    //
    // `config` is the resolved config, which will be used during runtime and
    // you should modify.
    // `userConfig` is the config as provided by the user. You should not modify
    // it.
    //
    // If you extended the `HardhatConfig` type, you need to make sure that
    // executing this function ensures that the `config` object is in a valid
    // state for its type, including its extensions. For example, you may
    // need to apply a default value, like in this example.
    const setting = userConfig.workspaces

    let workspaces = {}
    if (setting !== undefined) {
        const entries = Object.entries(setting).map(([network, dirs]) => {
            return [
                network,
                dirs.map((dir) => {
                    return path.isAbsolute(dir) ? dir : path.normalize(path.join(config.paths.root, dir))
                }),
            ]
        })
        workspaces = Object.fromEntries(entries)
    }

    config.workspaces = workspaces
})

extendEnvironment((hre) => {
    // We add a field to the Hardhat Runtime Environment here.
    // We use lazyObject to avoid initializing things until they are actually
    // needed.
    const providers: { [name: string]: EthereumProvider } = {}

    hre.buildHardhatRuntimeEnvironmentForWorkspace = buildHardhatRuntimeEnvironmentForWorkspace

    hre.runInHardhatRuntimeEnvironment = runInHardhatRuntimeEnvironment
})
