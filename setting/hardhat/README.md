## machanism

### let hardhat-deploy support mnemonic

hardhat-deploy-mnemonic plugin will generate private key `<KEY>` from `mnemonics` and override `namedAccounts` with `privateKey:://<KEY>`.

e.g., if the `namedAccounts` and `mnemonics` is defined in HardhatUserConfig as the following

```typescript
const config: HardhatUserConfig = {
  namedAccounts: {
    deployer: 0,
  },
  mnemonics: {
    deployer: {
      mnemonic: "test test test test test test test test test test test junk",
      path: `m/44'/60'/0'/0/0`,
    },
  },
};
```

then, `hardhat-deploy-mnemonic` will update the account of `hre.config.namedAccounts` with a private key.

```typescript
const config: HardhatUserConfig = {
  namedAccounts: {
    deployed:
      "privatekey://0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
};
```

### dynamic load the mnemonics from keys.yaml

keys.yaml has the following structure

```typescript
interface Keys {
  [stage in Stage]: {
    [chainType in ChainType]: {
      [accountName: string]: {
        mnemonic: string;
        path: string;
        address: string;
      };
    };
  };
}
```

e.g., if the keys.yaml contains

```json
{
    "testnet" : {
        "evm": {
            "layerzero": {
                "mnemonic": "test test test test test test test test test test test junk",
                "path: "m/44'/60'/0'/0/0",
            }
        }
    }
}
```

to support `hardhat console` and `packages/ops`, it needs to load the mnemonic from keys.yaml based on the `stage` environment variable.

```typescript
const config: HardhatUserConfig = {
  ...getMnemonics(process.env.STAGE),
};
```
