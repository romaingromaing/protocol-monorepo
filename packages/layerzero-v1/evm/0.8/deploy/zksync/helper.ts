import * as fs from 'fs'
import * as path from 'path'

import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { ethers } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Contract, Wallet } from 'zksync-web3'

// @ts-ignore
export async function deployContract(
    deployer: Deployer,
    contractName: string,
    args: any[],
    deploymentsFolder: string,
    deploymentName?: string,
    overwrite = false
): Promise<any> {
    if (!deploymentName) {
        deploymentName = contractName
    }

    let data = tryReadDeployment(deploymentsFolder, deploymentName)
    if (!overwrite && data) {
        console.log(`Skipping deployment of ${deploymentName} as it already exists`)
        return data
    }

    const artifact = await deployer.loadArtifact(contractName)
    console.log(`Deploying ${deploymentName}...`)
    const contract = await deployer.deploy(artifact, args)
    const receipt = await contract.deployTransaction.wait()

    data = {
        address: contract.address,
        abi: artifact.abi,
        transactionHash: receipt.transactionHash,
        receipt,
        args,
        numDeployments: data ? data.numDeployments + 1 : 1,
        bytecode: artifact.bytecode,
        deployedBytecode: artifact.deployedBytecode,
    }

    console.log(`${artifact.contractName} deployed to ${contract.address} (tx: ${receipt.transactionHash})`)

    writeDeployment(deploymentsFolder, deploymentName, data)

    if (!fs.existsSync(path.resolve(deploymentsFolder, '.chainId'))) {
        const { chainId } = await deployer.hre.ethers.provider.getNetwork()
        fs.writeFileSync(path.resolve(deploymentsFolder, '.chainId'), chainId.toString())
    }

    return data
}

export function readDeployment(deploymentsFolder: string, deploymentName: string): any {
    const filepath = path.resolve(deploymentsFolder, `${deploymentName}.json`)
    if (!fs.existsSync(filepath)) {
        throw new Error(`Deployment file not found: ${filepath}`)
    }
    // read the deployment json file
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
}

export function tryReadDeployment(deploymentsFolder: string, deploymentName: string): any {
    try {
        return readDeployment(deploymentsFolder, deploymentName)
    } catch (e) {
        return null
    }
}

export function writeDeployment(deploymentsFolder: string, deploymentName: string, data: any): void {
    if (!fs.existsSync(deploymentsFolder)) {
        console.log(`Creating deployments folder: ${deploymentsFolder}`)
        fs.mkdirSync(deploymentsFolder, { recursive: false })
    }

    const filepath = path.resolve(deploymentsFolder, `${deploymentName}.json`)
    console.log(`Writing to file: ${filepath}`)
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

export async function deployContractViaProxy(
    deployer: Deployer,
    proxyAdminWallet: Wallet,
    contractName: string,
    proxyAdmin: string,
    args: ExecuteArgs,
    deploymentsFolder: string,
    proxyAdminContractName = 'DefaultProxyAdmin'
): Promise<any> {
    let impl = tryReadDeployment(deploymentsFolder, `${contractName}_Implementation`)
    let proxy = tryReadDeployment(deploymentsFolder, `${contractName}_Proxy`)
    if (!proxy) {
        impl = await deployContract(deployer, contractName, [], deploymentsFolder, `${contractName}_Implementation`)

        const abi = new deployer.hre.ethers.utils.Interface(impl.abi)
        const initializer = abi.encodeFunctionData('initialize', args.initialize)
        console.log(`initializer: ${initializer}`)

        proxy = await deployContract(
            deployer,
            'TransparentUpgradeableProxy',
            [impl.address, proxyAdmin, initializer],
            deploymentsFolder,
            `${contractName}_Proxy`
        )

        proxy.abi = impl.abi.concat(proxy.abi)
        proxy.implementation = impl.address
        proxy.execute = {
            methodName: 'initialize',
            args: args.initialize,
        }
        writeDeployment(deploymentsFolder, contractName, proxy)
    }

    const artifact = await deployer.loadArtifact(contractName)

    if (!impl || impl.deployedBytecode !== artifact.deployedBytecode) {
        console.log(`Upgrading: ${contractName}`)
        // need upgrade
        proxy = await proxyUpdateContract(
            deployer,
            proxyAdminWallet,
            contractName,
            deploymentsFolder,
            args,
            proxyAdminContractName
        )
    } else {
        console.log(`Skipping deployment of ${contractName} as it already exists and not need upgrade`)
    }
    return proxy
}

async function proxyUpdateContract(
    deployer: Deployer,
    proxyAdminWallet: Wallet,
    contractName: string,
    deploymentsFolder: string,
    args: ExecuteArgs,
    proxyAdminContractName: string
): Promise<any> {
    const newImpl = await deployContract(
        deployer,
        contractName,
        [],
        deploymentsFolder,
        `${contractName}_Implementation`,
        true
    )

    const proxyAdminDeployer = new Deployer(deployer.hre, proxyAdminWallet)

    const proxyAdminDeployment = readDeployment(deploymentsFolder, proxyAdminContractName)
    const proxyDeployment = readDeployment(deploymentsFolder, `${contractName}_Proxy`)
    console.log(`proxyAdminWallet: ${proxyAdminWallet.address}`)

    const proxyAdminContract = new Contract(
        proxyAdminDeployment.address,
        proxyAdminDeployment.abi,
        proxyAdminDeployer.zkWallet
    )
    const abi = new deployer.hre.ethers.utils.Interface(newImpl.abi)

    const upgradeAndCall = 'onUpgrade' in args
    let receipt
    if (upgradeAndCall) {
        const onUpgrade = abi.encodeFunctionData('onUpgrade', args.onUpgrade)
        const handle = await proxyAdminContract.upgradeAndCall(proxyDeployment.address, newImpl.address, onUpgrade)
        receipt = await handle.wait()
    } else {
        const handle = await proxyAdminContract.upgrade(proxyDeployment.address, newImpl.address)
        receipt = await handle.wait()
    }

    proxyDeployment.abi = newImpl.abi.concat(proxyDeployment.abi)
    proxyDeployment.implementation = newImpl.address
    if (upgradeAndCall) {
        proxyDeployment.execute = {
            methodName: 'onUpgrade',
            args: args.onUpgrade,
        }
        proxyDeployment.args = args.onUpgrade
    } else {
        proxyDeployment.args = []
    }

    proxyDeployment.receipt = receipt
    proxyDeployment.transactionHash = receipt.transactionHash
    proxyDeployment.numDeployments += 1
    writeDeployment(deploymentsFolder, contractName, proxyDeployment)

    return proxyDeployment
}

interface ExecuteArgs {
    initialize: (number | string)[]
    onUpgrade?: (number | string)[]
}

export function getZksyncWalletFromMnemonics(
    mnemonics: {
        [name: string]: {
            mnemonic?: string
            path?: string
            address?: string
        }
    },
    name: string
): Wallet {
    const mnemonic = mnemonics[name]
    if (!mnemonic || !mnemonic.mnemonic) {
        throw new Error(`${name} mnemonic not found`)
    }
    const ethersWallet = ethers.Wallet.fromMnemonic(mnemonic.mnemonic, mnemonic.path)
    return new Wallet(ethersWallet.privateKey)
}

export function getZksyncDeployerFromMnemonics(
    hre: HardhatRuntimeEnvironment,
    mnemonics: {
        [name: string]: {
            mnemonic?: string
            path?: string
            address?: string
        }
    },
    name: string
): Deployer {
    const zkWallet = getZksyncWalletFromMnemonics(mnemonics, name)
    return new Deployer(hre, zkWallet)
}

export function getAddressByPackage(packageName: string, network: string, contractName: string) {
    const packageRoot = path.dirname(require.resolve(`@layerzerolabs/${packageName}/package.json`))
    const deploymentsFolder = `${packageRoot}/deployments/${network}`
    const deployment = readDeployment(deploymentsFolder, contractName)
    return deployment.address
}
export function getAddress(deploymentsFolder: string, deploymentName: string) {
    const deployment = readDeployment(deploymentsFolder, deploymentName)
    return deployment.address
}
