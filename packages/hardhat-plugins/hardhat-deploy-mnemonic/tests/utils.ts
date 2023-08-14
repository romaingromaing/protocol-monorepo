import { HardhatContext } from 'hardhat/internal/context'
import { Environment } from 'hardhat/internal/core/runtime-environment'
import { resetHardhatContext } from 'hardhat/plugins-testing'
import { HardhatArguments, HardhatConfig, HardhatRuntimeEnvironment } from 'hardhat/types'

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
            HardhatContext.getHardhatContext().environment!['injectToGlobal']() // inject the members of hre to global
        }
    }
}

/**
 *
 * @param network
 * @param extendConfig
 * @returns
 */
export function buildHardhatEnvironment(ctx: HardhatContext, network: string): HardhatRuntimeEnvironment {
    const hardhatArguments: HardhatArguments = {
        network: network,
        showStackTraces: true,
        version: true,
        emoji: true,
        help: false,
        verbose: false,
    }

    const userConfig = {}
    // @ts-ignore
    const resolvedConfig: HardhatConfig = {}

    for (const extender of ctx.configExtenders) {
        extender(resolvedConfig, userConfig)
    }

    const envExtenders = ctx.extendersManager.getExtenders()
    const taskDefinitions = ctx.tasksDSL.getTaskDefinitions()

    // @ts-ignore
    const env: HardhatRuntimeEnvironment = new Environment(
        resolvedConfig,
        hardhatArguments,
        taskDefinitions,
        envExtenders,
        ctx.experimentalHardhatNetworkMessageTraceHooks,
        userConfig
    )

    return env
}
