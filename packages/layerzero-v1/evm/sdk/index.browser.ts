export * from './chaintypes'

export function getDeployedContractAddress(network: string, contractName: string): string {
    throw new Error(`Not supported in browser, please use require(deployments/${network}/${contractName}.json instead`)
}
