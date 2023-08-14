import * as path from 'path'

import { HardhatContext } from 'hardhat/internal/context'
import { loadConfigAndTasks } from 'hardhat/internal/core/config/config-loading'
import { HardhatError } from 'hardhat/internal/core/errors'
import { ERRORS } from 'hardhat/internal/core/errors-list'
import { Environment as HardhatRuntimeEnvironmentImpl } from 'hardhat/internal/core/runtime-environment'
import { resetHardhatContext } from 'hardhat/plugins-testing'
import { HardhatArguments, HardhatRuntimeEnvironment, HardhatRuntimeEnvironmentContext } from 'hardhat/types'

import { WorkspacesConfig } from './type-extensions'

function _buildHardhatRuntimeEnvironmentForWorkspace(
    workspace: string,
    network: string | undefined
): HardhatRuntimeEnvironmentContext {
    const hardhatArguments: HardhatArguments = {
        config: path.join(workspace, 'hardhat.config.ts'),
        network: network,
        showStackTraces: true,
        version: true,
        emoji: true,
        help: false,
        verbose: false,
    }

    //! packages/hardhat-core/src/internal/cli/cli.ts, main
    if (HardhatContext.isCreated()) {
        resetHardhatContext()
    }
    const ctx = HardhatContext.createHardhatContext()
    const { resolvedConfig, userConfig } = loadConfigAndTasks(hardhatArguments, {
        showEmptyConfigWarning: true,
        showSolidityConfigWarnings: true,
    })

    const envExtenders = ctx.environmentExtenders
    const taskDefinitions = ctx.tasksDSL.getTaskDefinitions()

    // @ts-ignore
    const env: HardhatRuntimeEnvironment = new HardhatRuntimeEnvironmentImpl(
        resolvedConfig,
        hardhatArguments,
        taskDefinitions,
        envExtenders,
        ctx.experimentalHardhatNetworkMessageTraceHooks,
        userConfig
    )

    ctx.setHardhatRuntimeEnvironment(env)

    const restoreContext = captureContext()
    return { env, restoreContext }
}

/**
 * create a HardhatContext, load config and tasks of a workspace, create a HardhatRuntimeEnvironment, and return it with the context restore function
 * @param workspace
 * @param network
 * @returns
 */
export function buildHardhatRuntimeEnvironmentForWorkspace(
    workspace: string,
    network: string | undefined
): HardhatRuntimeEnvironmentContext {
    const unleashContext = captureContext()
    try {
        return _buildHardhatRuntimeEnvironmentForWorkspace(workspace, network)
    } finally {
        unleashContext()
    }
}

/**
 * save the state affected by the resetHardhatContext, and return a function to restore it
 * @returns
 */
export function captureContext() {
    //@ts-ignore
    const globalAsAny = global as any

    const ctx: HardhatContext = globalAsAny.__hardhatContext
    const hre: HardhatRuntimeEnvironment = globalAsAny.hre

    const modules: { [key in string]: NodeModule | undefined } = {}

    if (HardhatContext.isCreated()) {
        // guard against the context being renamed by the hardhat team
        if (ctx !== HardhatContext.getHardhatContext()) {
            throw new Error('global.__hardhatContext is not the same as HardhatContext.getHardhatContext()')
        }

        const filesLoadedDuringConfig = ctx.getFilesLoadedDuringConfig()
        filesLoadedDuringConfig.forEach((path: string) => {
            modules[path] = require.cache[require.resolve(path)]
        })

        resetHardhatContext()
    }

    return () => {
        // clean up the state
        resetHardhatContext()

        // restore the state
        const globalAsAny = global as any
        globalAsAny.__hardhatContext = ctx
        globalAsAny.hre = hre

        Object.entries(modules).forEach(([path, module]) => {
            require.cache[path] = module
        })

        if (
            HardhatContext.isCreated() &&
            HardhatContext.getHardhatContext() !== undefined &&
            HardhatContext.getHardhatContext().environment !== undefined
        ) {
            const environment = HardhatContext.getHardhatContext().environment
            const environmentImpl = environment as unknown as HardhatRuntimeEnvironmentImpl
            environmentImpl.injectToGlobal() // inject the members of hre to global
        }
    }
}

/**
 * execute a function in a HardhatRuntimeEnvironment, you should restore the context of the HardhatRuntimeEnvironment first.
 * @param env
 * @param fn
 * @returns
 */
export async function runInHardhatRuntimeEnvironment<T>(env: HardhatRuntimeEnvironment, fn: () => T): Promise<T> {
    //! packages/hardhat-core/src/internal/core/runtime-environment.ts, _runTaskDefinition
    const environmentImpl = env as unknown as HardhatRuntimeEnvironmentImpl
    const uninjectFromGlobal = environmentImpl.injectToGlobal()
    let retval: T
    try {
        retval = await fn()
    } finally {
        uninjectFromGlobal()
    }
    return retval
}

/**
 * run a function in a HardhatRuntimeEnvironment of a workspace, it will restore the context of the HardhatRuntimeEnvironment before executing the function. it will avoid populating the global, e.g., hre and __hardhatContext.
 * @param workspace
 * @param network
 * @param fn
 * @returns
 */
export async function runInWorkspace<T>(workspace: string, network: string, fn: (env: HardhatRuntimeEnvironment) => T) {
    const unleashContext = captureContext()

    try {
        const ctx = buildHardhatRuntimeEnvironmentForWorkspace(workspace, network)
        ctx.restoreContext()
        return await fn(ctx.env)
    } finally {
        unleashContext()
    }
}

/**
 * force run a function in a workspace, even if the workspace doesn't have the network config. it will avoid populating the global, e.g., hre and __hardhatContext.
 * @param workspace
 * @param network
 * @param fn
 * @returns
 */
export async function forceRunInWorkspace(
    workspace: string,
    network: string,
    fn: (hre: HardhatRuntimeEnvironment) => Promise<void>
) {
    try {
        return await runInWorkspace(workspace, network, fn)
    } catch (e) {
        if (!HardhatError.isHardhatErrorType(e, ERRORS.NETWORK.CONFIG_NOT_FOUND)) {
            throw e
        } else {
            console.log(`Workspace ${workspace} doesn't have config for network ${network}`)
        }
    }
}

/**
 * return the workspaces listed in the hardhat.config.ts of the root workspace
 * @param root
 * @returns
 */
export function getWorkspaces(root: string): WorkspacesConfig {
    // save the current context
    const unleashContext = captureContext()

    try {
        const ctx = buildHardhatRuntimeEnvironmentForWorkspace(root, undefined)
        return ctx.env.config.workspaces
    } finally {
        // restore the context
        unleashContext()
    }
}
