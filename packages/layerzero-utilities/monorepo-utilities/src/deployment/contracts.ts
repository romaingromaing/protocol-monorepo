import { Provider } from '@ethersproject/providers'
import { ethers } from 'ethers'

import { Network } from '@layerzerolabs/lz-definitions'

import { Deployment, readDeployment, tryReadDeployment } from './deployment'

export function tryGetContract<T extends ethers.Contract>(
    network: Network,
    packageRoot: string,
    contractName: string,
    provider?: Provider
): T | undefined {
    const deployment = tryReadDeployment(packageRoot, network, contractName)
    if (!deployment) {
        return undefined
    }
    return getContractByDeployment(deployment, provider) as T
}

export function getContract<T extends ethers.Contract>(
    network: string,
    packageRoot: string,
    contractName: string,
    provider?: Provider
): T {
    const deployment = readDeployment(packageRoot, network, contractName)
    return getContractByDeployment(deployment, provider) as T
}

export function getContractByDeployment<T extends ethers.Contract>(deployment: Deployment, provider?: Provider): T {
    const Contract = new ethers.ContractFactory(deployment.abi, deployment.bytecode)
    const contract = Contract.attach(deployment.address) as T
    if (provider) {
        return contract.connect(provider) as T
    }
    return contract
}
