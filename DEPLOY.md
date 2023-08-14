# Deploy a new LZ Endpoint and wire it up

Deploying new endpoints on monorepo

1. add endpointId to endpoint-id.ts // add XXX_V2_TESTNET or whatnot too
2. update connections for stage connections/<stage>.json
3. Update wire-all configuration in ops/src/config/<stage>.ts | update config-v2/mainnet.ts \*
4. add rpc to node-url.json
5. point endpointId to the right environment in constants/environment.ts
6. update chain name in chain.ts
   6.1.chain-key.ts
   6.2 chainKey.ts
   6.5: yarn clean && yarn build

// MUST deploy pricefeed v2
6.9: yarn :ops deploy all-v2 -s testnet -sp priceFeed -f optimism

7. run deploy
   yarn :ops deploy all-v1 deploy -ol <oracle type> -s <stage> -f <from chains>

// example deploy
$ yarn :ops deploy all-v1 deploy -ol multisig -s testnet -f kava

// wire 8. yarn :ops wire all-v1 -ol <oracle type> -s <stage> -f <from chains> -t <to chains>

9 bump versions

$ yarn bump-version <version>

10 publish packages

$ yarn :publish-packages
