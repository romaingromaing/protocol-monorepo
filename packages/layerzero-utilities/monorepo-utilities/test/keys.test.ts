import { expect } from 'chai'

import { ChainType, Stage } from '@layerzerolabs/lz-definitions'

import { aptosKeyUtils, evmKeyUtils, keyUtils, solanaKeyUtils } from '../src'

describe('layerzero-utilities keys', function () {
    it('It should load testnet evm keys', async function () {
        const emvKeys = keyUtils.getKeys(Stage.TESTNET, ChainType.EVM)
        expect(emvKeys).to.exist
    })
    it('It should load testnet solana keys', async function () {
        const emvKeys = keyUtils.getKeys(Stage.TESTNET, ChainType.SOLANA)
        expect(emvKeys).to.exist
    })
    it('It should load testnet aptos keys', async function () {
        const emvKeys = keyUtils.getKeys(Stage.TESTNET, ChainType.APTOS)
        expect(emvKeys).to.exist
    })
    it('It should load testnet evm layerzero key', async function () {
        const layerzeroKey = keyUtils.getKey(Stage.TESTNET, ChainType.EVM, 'layerzero')
        expect(layerzeroKey?.mnemonic).to.exist
        const layerzero1Key = keyUtils.getKey(Stage.TESTNET, ChainType.EVM, 'layerzero1')
        expect(layerzero1Key?.mnemonic).to.not.exist
    })
    it('It should load testnet solana layerzero key', async function () {
        const layerzeroKey = keyUtils.getKey(Stage.TESTNET, ChainType.SOLANA, 'layerzero')
        expect(layerzeroKey?.mnemonic).to.exist
    })
    it('It should load testnet aptos layerzero key', async function () {
        const layerzeroKey = keyUtils.getKey(Stage.TESTNET, ChainType.APTOS, 'layerzero')
        expect(layerzeroKey?.mnemonic).to.exist
    })
    it('It should load testnet evm layerzero wallet', async function () {
        const layerzeroWallet = evmKeyUtils.getChainWallet(Stage.TESTNET, 'layerzero')
        expect(layerzeroWallet?.address).to.exist
    })

    it('It should load testnet solana keypair', async function () {
        const layerzeroKeypair = solanaKeyUtils.getChainWallet(Stage.TESTNET, 'layerzero')
        expect(layerzeroKeypair?.publicKey.toBase58()).to.exist
    })
    it('It should load testnet aptos account', async function () {
        const layerzeroAccount = aptosKeyUtils.getChainWallet(Stage.TESTNET, 'layerzero')
        expect(layerzeroAccount?.address()).to.exist
    })

    describe('aptos keys', function () {
        it('Load mnemonic works', async function () {
            const mnemonic = 'test test test test test test test test test test test junk'
            const account = aptosKeyUtils.getAccount(mnemonic)
            expect(account.address().toString()).to.equal(
                '0xbfef909638ef90885158fdab9f56e216fd811fe25b32ead0bc2a272d66522bb0'
            )
        })

        it('Load private key works', async function () {
            const privateKey = '0x5dcfb370a3bfe328b15971dad3d6db9722db3ac47ba2b19a2725d4bea7f529e2'
            const account = aptosKeyUtils.getAccountByPrivateKey(privateKey)
            expect(account.address().toString()).to.equal(
                '0xbfef909638ef90885158fdab9f56e216fd811fe25b32ead0bc2a272d66522bb0'
            )
        })
    })
})
