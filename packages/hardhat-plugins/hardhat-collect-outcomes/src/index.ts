import { glob } from 'glob'
import { TASK_COMPILE_SOLIDITY_COMPILE_JOBS } from 'hardhat/builtin-tasks/task-names'
import { extendConfig, extendEnvironment, subtask } from 'hardhat/config'
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types'
import { TASK_DEPLOY_RUN_DEPLOY } from 'hardhat-deploy'

// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import './type-extensions'
import { abspath, copyFilesInRelativePath } from './utils'

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    // We apply our default config here. Any other kind of config resolution
    // or normalization should be placed here.
    //
    // `config` is the resolved config, which will be used during runtime and
    // you should modify.
    // `userConfig` is the config as provided by the user. You should not modify
    // it.
    //
    // If you extended the `HardhatConfig` type, you need to make sure that
    // executing this function ensures that the `config` object is in a valid
    // state for its type, including its extensions. For example, you may
    // need to apply a default value, like in this example.
    const userCollects = userConfig.paths?.collects ?? {}
    config.paths.collects = {}

    if (userCollects.artifacts !== undefined) {
        const setting = userCollects.artifacts
        config.paths.collects.artifacts = {
            target: abspath(setting.target, config.paths.root),
            patterns: setting.patterns ?? [],
            skip: setting.skip,
        }
    }

    if (userCollects.deployments !== undefined) {
        const setting = userCollects.deployments
        config.paths.collects.deployments = {
            target: abspath(setting.target, config.paths.root),
            patterns: setting.patterns ?? [],
        }
    }

    if (userCollects.typechain !== undefined) {
        const setting = userCollects.typechain
        config.paths.collects.typechain = {
            target: abspath(setting.target, config.paths.root),
            patterns: setting.patterns ?? [],
        }
    }
})

extendEnvironment((hre) => {})

subtask(TASK_COMPILE_SOLIDITY_COMPILE_JOBS, 'copying artifacts').setAction(
    async (taskArgs, { config, network }, runSuper) => {
        const compileSolOutput = await runSuper(taskArgs)
        if (config.paths.collects.artifacts === undefined) {
            return compileSolOutput
        }

        const { skip } = config.paths.collects.artifacts
        if (skip) {
            if (skip.zksync !== undefined && skip.zksync === network.zksync) {
                return compileSolOutput
            }
        }
        const artifactsRoot = config.paths.artifacts
        const patterns = config.paths.collects.artifacts!.patterns.map((p) => `${artifactsRoot}/${p}`)
        const target = config.paths.collects.artifacts!.target
        for (const pattern of patterns) {
            const files = await glob(pattern)
            await Promise.all(
                files.map(async (f) => {
                    await copyFilesInRelativePath(artifactsRoot, f, target)
                })
            )
        }

        return compileSolOutput
    }
)

subtask(TASK_DEPLOY_RUN_DEPLOY, 'deploy run only').setAction(async (taskArgs, { config }, runSuper) => {
    const deployOutput = await runSuper(taskArgs)
    if (config.paths.collects.deployments === undefined) {
        return deployOutput
    }
    const deploymentsRoot = config.paths.deployments
    const patterns = config.paths.collects.deployments!.patterns.map((p) => `${deploymentsRoot}/${p}`)
    const target = config.paths.collects.deployments!.target
    for (const pattern of patterns) {
        const files = await glob(pattern)
        await Promise.all(
            files.map(async (f) => {
                await copyFilesInRelativePath(deploymentsRoot, f, target)
            })
        )
    }

    return deployOutput
})
