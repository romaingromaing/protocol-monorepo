# hardhat-workspace

## files

- `index.ts`: the entry point to this module, can be imported in the hardhat.config.ts, and will change the HardhatContext.
- `utils.ts`: utility functions, can be imported individually, and will not change the HardhatContext.

## usage

use `mnemonics` field to overwrite the setting of `namedAccounts`.

### overwrite the mnemonic

```
const config: HardhatUserConfig = {
    namedAccounts: {
        deployer: 0
    },
    mnemonics: {
        deployer: {
            mnemonic: 'test test test test test test test test test test test junk',
            path: `m/44'/60'/0'/0'/0'`,
        }
    }
}
```

it will be equivalent to

```
const config: HardhatUserConfig = {
    namedAccounts: {
        deployer: 'privatekey://0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    },
}
```

### overwrite with address

```
const config: HardhatUserConfig = {
    namedAccounts: {
        deployer: 0
    },
    mnemonics: {
        deployer: {
            address: '0x0000000000000000000000000000000000000001',
        }
    }
}
```

it will be equivalent to

```
const config: HardhatUserConfig = {
    namedAccounts: {
        deployer: '0x0000000000000000000000000000000000000001'
    },
}
```

## TODO

- [ ] specialized for networks
