import fs from 'fs'
import path from 'path'

import { glob } from 'glob'

export interface Artifact {
    _format: string
    contractName: string
    sourceName: string
    abi: any[]
    bytecode: string // "0x"-prefixed hex string
    deployedBytecode: string // "0x"-prefixed hex string
    linkReferences: LinkReferences
    deployedLinkReferences: LinkReferences
}

export interface LinkReferences {
    [libraryFileName: string]: {
        [libraryName: string]: Array<{ length: number; start: number }>
    }
}

const artifactsCache: { [key: string]: Artifact } = {}
export function readArtifact(packageRoot: string, contractName: string, forceRefresh = false): any {
    const key = `${packageRoot}-${contractName}`
    if (!artifactsCache[key] || forceRefresh) {
        const searchPath = path.join(packageRoot, `artifacts/contracts*/**/${contractName}.json`)
        const filePath = glob.sync(searchPath).filter((f: string) => f.includes(`${contractName}.json`))[0]
        artifactsCache[key] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
    return artifactsCache[key]
}
