import * as fs from 'fs'
import * as path from 'path'

import { ethers } from 'ethers'

export interface Deployment {
    address: string
    abi: any
    transactionHash: string
    receipt: ethers.providers.TransactionReceipt
    args: any[]
    numDeployments: number
    solcInputHash?: string
    metadata?: string
    bytecode: string
    deployedBytecode: string
    execute?: {
        methodName: string
        args: (number | string)[]
    }
    implementation?: string
}

const deploymentsCache: { [key: string]: Deployment } = {}

export function readDeployment(
    packageRoot: string,
    network: string,
    contractName: string,
    forceRefresh = false
): Deployment {
    const key = `${packageRoot}-${network}-${contractName}`
    if (!deploymentsCache[key] || forceRefresh) {
        const deploymentJson = `${packageRoot}/deployments/${network}/${contractName}.json`
        if (!fs.existsSync(deploymentJson)) {
            throw new Error(`Deployment not found: ${deploymentJson}`)
        }
        deploymentsCache[key] = JSON.parse(fs.readFileSync(deploymentJson, 'utf-8'))
    }
    return deploymentsCache[key]
}

export function tryReadDeployment(
    packageRoot: string,
    network: string,
    deploymentName: string,
    forceRefresh = false
): Deployment | undefined {
    try {
        return readDeployment(packageRoot, network, deploymentName, forceRefresh)
    } catch (e) {
        return
    }
}

export function writeDeployment(packageRoot: string, network: string, deploymentName: string, deployment: Deployment) {
    const filePath = path.join(packageRoot, `deployments/${network}/${deploymentName}.json`)
    fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2))
}

export function createDeploymentsFolder(packageRoot: string, network: string, chainId: number): string {
    const deploymentFolder = path.join(packageRoot, `deployments/${network}`)
    if (!fs.existsSync(deploymentFolder)) {
        fs.mkdirSync(deploymentFolder)
        fs.writeFileSync(path.resolve(deploymentFolder, '.chainId'), chainId.toString())
        console.log(`created deployments folder: ${deploymentFolder}`)
    }
    return deploymentFolder
}
