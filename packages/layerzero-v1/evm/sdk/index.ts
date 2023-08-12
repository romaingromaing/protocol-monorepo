import * as fs from 'fs'
import path from 'path'

export * from './chaintypes'

export function getDeployedContractAddress(network: string, contractName: string): string {
    const deploymentJson = `${path.join(__dirname, '..')}/deployments/${network}/${contractName}.json`
    if (!fs.existsSync(deploymentJson)) {
        throw new Error(`Deployment not found: ${deploymentJson}, did you forget to deploy ${contractName}?`)
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentJson, 'utf-8'))
    return deployment.address
}
