import { createProvider } from 'hardhat/internal/core/providers/construction'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Network } from 'hardhat/types/runtime'
import { DeploymentsManager } from 'hardhat-deploy/dist/src/DeploymentsManager'

/**
 * when hardhat-deploy-ethers is imported, the hre.ethers will be bind to the hre object at that moment.
 * deploymentManager.runDeploy will call _deploy which will call saveDeployment to store deployment in db.deployments,
 * but the hre.ethers.getContract will not access that db.deployments.
 * so we need to use the original hre object to create the deployment manager, otherwise the hre.ethers will not work.
 * @param env should be the original hre object
 * @param network
 * @returns
 */
export function getDeploymentManager(env: HardhatRuntimeEnvironment, network: string | Network): any {
    let _network: any
    if (typeof network === 'string') {
        //@ts-ignore
        _network = Object.assign(Object.create(Object.getPrototypeOf(env.network)), env.network)
        _network.name = network
        _network.config = env.config.networks[network]
        _network.provider = createProvider(env.config, network, env.artifacts)
    } else {
        _network = network
    }

    const _env = env

    //@ts-ignore
    //_env.network = _network //todo 2.16.0 cannot support modify the network
    //@ts-ignore
    const deploymentsManager = new DeploymentsManager(_env, _network)
    //@ts-ignore
    _env.deployments = deploymentsManager.deploymentsExtension
    //@ts-ignore
    _env.getNamedAccounts = deploymentsManager.getNamedAccounts.bind(deploymentsManager)
    //@ts-ignore
    _env.getUnnamedAccounts = deploymentsManager.getUnnamedAccounts.bind(deploymentsManager)
    //@ts-ignore
    _env.getChainId = () => {
        return deploymentsManager.getChainId()
    }
    return deploymentsManager
}
