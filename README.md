## Prerequisite

- [zsh](https://ohmyz.sh/) is recommended, it will load the `.zshenv` file automatically in each shell session.
- [docker](https://docs.docker.com/desktop/)
- [docker-compose](https://docs.docker.com/compose/)

## Installation

```shell
git clone https://github.com/LayerZero-Labs/monorepo.git
cd monorepo
yarn
./scripts/install-dependencies
yarn :clean
yarn :build
yarn :test
yarn :it
```

Very nice reset command if you get into a bad spot and are trying to wipe & install from scratch but keep your config files and turbo cache.

```shell
git reset --hard HEAD && git clean -d -f -x -e config -e .idea -e node_modules/.cache/turbo/
```

You can try this command if you encounter a thorny problem

```shell
git reset --hard HEAD && git clean -d -f -x
rm yarn.lock
```

## Layout

- `lib`: forge libraries.
- `apps`: OApps.
- `config`: configuration files for runtime environments.
- `packages`: packages and libraries.
  - `hardhat-plugins`: hardhat plugins.
    - `hardhat-workspace`: reference multiple hardhat projects in a single workspace.
  - `layerzero-definitions`: layerzero definitions.
  - `layerzero-v1`:
    - aptos: aptos modules.
    - evm: evm contracts.
  - `layerzero-v2`:
  - `layerzero-worker-sdk`: layerzero worker sdk, which is used for building workers.
  - `localnet`: projects for localnet environment.
    - `aptos`: Dockerfile for building a slim aptos image(arm64/amd64).
    - `hardhat`: Dockerfile for building a hardhat barebone image(arm64/amd64), which is used for launching EVM chains.
    - `k8s`: kubernetes manifests for localnet.
  - `ops`: projects for deployment and configuration.
  - `rust-crates`: rust packages.
  - `testify`: extensible and composable test framework.
- `scripts`: scripts for development and deployment.
- `settings`: settings files for development tools and libraries.

## Documentation

- [Getting start](./docs/getting-start.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Development guide](./docs/development-guide.md)
- [Localnet guide](./docs/localnet-guide.md)
- [Migration guide](./docs/migration-guide.md)
- [Contributing](./CONTRIBUTING.md)
- [CHANGELOG](./CHANGELOG.md)

## TODO

- [ ] set `noImplicitAny=true` in `tsconfig.json` to find potential issues
- [ ] should be able to modify config and performance integration tests on forked state
- [ ] speed up the build process
