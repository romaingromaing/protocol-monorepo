import { HardhatUserConfig, extendConfig, extendEnvironment } from 'hardhat/config'
import { HardhatConfig } from 'hardhat/types'

// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import './type-extensions'
import { overwriteNamedAccounts } from './utils'

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
})

extendEnvironment((hre) => {
    overwriteNamedAccounts(hre.config, hre.userConfig)
})
