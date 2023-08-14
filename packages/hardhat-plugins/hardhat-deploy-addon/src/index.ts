import { extendEnvironment } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { EthereumProvider } from 'hardhat/types/provider'

// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import './type-extensions'
import { getDeploymentManager } from './utils'

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
    // We add a field to the Hardhat Runtime Environment here.
    // We use lazyObject to avoid initializing things until they are actually
    // needed.
    const providers: { [name: string]: EthereumProvider } = {}

    hre.getDeploymentManager = function (network: string): any {
        getDeploymentManager(this, network)
    }
})
