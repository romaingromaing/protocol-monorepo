import * as path from 'path'

import { minimatch } from 'minimatch'

const fs = require('node:fs')
const util = require('node:util')

export function abspath(p: string, root: string) {
    if (path.isAbsolute(p)) {
        return p
    }
    return path.normalize(path.join(root, p))
}

export async function globFiles(files: string[], patterns: string[]): Promise<string[]> {
    const retval: string[] = []
    for (const pattern of patterns) {
        const rv = files.filter(minimatch.filter(pattern, { matchBase: true }))
        retval.push(...rv)
    }
    return retval
}

export async function copyFilesInRelativePath(root: string, sour: string, target: string) {
    if (!path.isAbsolute(sour)) {
        throw new Error(`sour must be absolute path: ${sour}`)
    }
    const relative = path.relative(root, sour)
    const dest = path.join(target, relative)
    const dir = path.dirname(dest)
    if (!fs.exists(dir)) {
        await util.promisify(fs.mkdir)(dir, { recursive: true })
    }
    await util.promisify(fs.copyFile)(sour, dest)
}
