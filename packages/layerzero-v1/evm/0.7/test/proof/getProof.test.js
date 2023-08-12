const { ethers } = require('hardhat');
const { readData, verifyAllLogs, verifyAllLogsInTransactions } = require('../../utils/proof');
const { OutboundProofType, EVMUtilityVersion } = require('@layerzerolabs/lz-proof-utility');

describe('GetProof', () => {
    let mpt, mptV2;

    before(async () => {
        const MPTValidator = await ethers.getContractFactory('MPTValidator');
        const MPTValidatorV2 = await ethers.getContractFactory('MPTValidatorV2');
        mpt = await MPTValidator.deploy();
        await mpt.deployed();
        mptV2 = await MPTValidatorV2.deploy();
        await mptV2.deployed();
    });

    describe('Moonbeam', async () => {
        it('moonbeam-testnet (aka: Moonbase)', async () => {
            //fails
            const data = readData('moonbeam-testnet', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('moonbeam (mainnet) 1', async () => {
            const data = readData('moonbeam', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
        it('moonbeam (mainnet) 2', async () => {
            const data = readData('moonbeam', 'tx2');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        // Moonbase alpha is the Moonbeam testnet
        // https://rpc.testnet.moonbeam.network
        it('moonbeam-testnet (aka: Moonbase Alpha)', async () => {
            const data = readData('moonbeam-testnet', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
    });

    describe('Ethereum', async () => {
        describe('Ropsten', async () => {
            it('post EIP-1559', async () => {
                const data = readData('ropsten', 'postEIP1559');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });

            it('pre EIP-1559', async () => {
                const data = readData('ropsten', 'preEIP1559');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });

        describe('Mainnet', async () => {
            it('post EIP-1559 300 txn', async () => {
                const data = readData('ethereum', 'BpostEIP1559_300');
                await verifyAllLogsInTransactions(
                    mptV2,
                    data.block,
                    data.receipts,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2,
                    260,
                    1000
                );
            });

            it.skip('post EIP-1559 471 txn', async () => {
                const data = readData('ethereum', 'BpostEIP1559_471');
                await verifyAllLogsInTransactions(
                    mptV2,
                    data.block,
                    data.receipts,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2,
                    450,
                    1000
                );
            });

            it.skip('post EIP-1559 x txn', async () => {
                const data = readData('ethereum', 'BpostEIP1559');
                await verifyAllLogsInTransactions(
                    mptV2,
                    data.block,
                    data.receipts,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2,
                    255,
                    1000
                );
            });
        });

        describe('Rinkeby', async () => {
            it('failed log', async () => {
                const data = readData('rinkeby', 'failedLog');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });
    });

    describe('Polygon Edge Node', async () => {
        describe('Arcana - Polygon Edge Node', async () => {
            it('failed log', async () => {
                const data = readData('arcana', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });
    });

    describe('Avalanche', async () => {
        it('Mainnet', async () => {
            const data = readData('avalanche', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('Fuji C-Chain', async () => {
            const data = readData('fuji', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
    });

    describe('Binance Smart Chain', async () => {
        describe('Testnet', async () => {
            it('', async () => {
                const data = readData('fuji', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });

        describe('Mainnet', async () => {
            it('single tx', async () => {
                const data = readData('bsc', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
            it('loop all (1)', async () => {
                const data = readData('bsc', 'B41'); //15689194, 41 txn
                await verifyAllLogsInTransactions(
                    mptV2,
                    data.block,
                    data.receipts,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2,
                    0,
                    1000
                );
            });
            it.skip('loop all (2)', async () => {
                const data = readData('bsc', 'B400'); // 400 txn
                await verifyAllLogsInTransactions(
                    mptV2,
                    data.block,
                    data.receipts,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2,
                    0,
                    1000
                );
            });
        });
    });

    describe('Optimism', async () => {
        it('Kovan', async () => {
            const data = readData('optimism-kovan', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('Mainnet', async () => {
            const data = readData('optimism', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
    });

    describe('Arbitrum', async () => {
        it('Rinkeby', async () => {
            const data = readData('arbitrum-rinkeby', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1,
                'arbitrum'
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2,
                'arbitrum'
            );
        });

        it('Goerli', async () => {
            // https://goerli-rollup.arbitrum.io/rpc
            const data = readData('arbitrum-goerli', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('Mainnet', async () => {
            //todo:
        });
    });

    describe('Polygon', async () => {
        describe('Mumbai', async () => {
            it('common tx', async () => {
                const data = readData('mumbai', 'commonTx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
            it('block has state sync txn ignored in receipt proof', async () => {
                const data = readData('mumbai', 'stateSyncIgnored');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1,
                    'polygon'
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2,
                    'polygon'
                );
            });
        });

        describe('Mainnet', async () => {
            it('tx', async () => {
                const data = readData('polygon', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });
    });

    describe('Harmony', async () => {
        describe('Testnet', async () => {
            //https://api.s0.pops.one/
            it('tx', async () => {
                const data = readData('harmony-testnet', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });

        describe('Mainnet', async () => {
            //https://harmony-0-rpc.gateway.pokt.network
            it('tx without shard id', async () => {
                //use the ethereum hash instead.
                const data = readData('harmony', 'txWithoutShardId');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
            it('tx with shard id', async () => {
                //tx with the shard id, both would work
                const data = readData('harmony', 'txWithShardId');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
            it('tx in block with staking transaction', async () => {
                const data = readData('harmony', 'txWithStakingTx');
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2,
                    'harmony'
                );
            });
        });
    });

    describe('HECO', async () => {
        it('Testnet', async () => {
            //https://http-testnet.hecochain.com
            const data = readData('heco-testnet', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('Mainnet', async () => {
            //todo:
        });
    });

    describe('Boba', async () => {
        it('Rinkeby', async () => {
            //https://rinkeby.boba.network
            const data = readData('boba-rinkeby', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('Mainnet', async () => {
            //https://mainnet.boba.network
            const data = readData('boba', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
    });

    describe.skip('Aurora', async () => {
        it('Testnet', async () => {
            //https://testnet.aurora.dev/
            const data = readData('aurora-testnet', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
    });

    describe('Fuse', async () => {
        it('testnet', async () => {
            // https://rpc.fusespark.io/
            const data = readData('fuse-testnet', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('Mainnet', async () => {
            // https://rpc.fuse.io
            const data = readData('fuse', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
    });

    describe('Avax Subnet', () => {
        describe('Swimmer', async () => {
            it('Mainnet', async () => {
                const data = readData('swimmer', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });

            it('Testnet', async () => {
                const data = readData('swimmer-testnet', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });

        describe('Defi Kingdoms', async () => {
            it('Mainnet', async () => {});

            it('Testnet', async () => {
                const data = readData('dfk-testnet', 'tx');
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });

        describe('Dexalot', async () => {
            it('Testnet', async () => {
                const data = readData('dexalot-testnet', 'tx');
                await verifyAllLogs(
                    mpt,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V1
                );
                await verifyAllLogs(
                    mptV2,
                    data.block,
                    data.receipts,
                    data.transactionIndex,
                    OutboundProofType.MPT,
                    EVMUtilityVersion.V2
                );
            });
        });
    });

    describe('Celo', async () => {
        it('Mainnet', async () => {
            // https://forno.celo.org
            const data = readData('celo', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        it('Testnet (alfajores)', async () => {
            const data = readData('celo-testnet', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });
    });

    describe('Astra', async () => {
        it.skip('testnet', async () => {
            const data = readData('astra-testnet', 'tx');
            await verifyAllLogs(
                mpt,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V1
            );
            await verifyAllLogs(
                mptV2,
                data.block,
                data.receipts,
                data.transactionIndex,
                OutboundProofType.MPT,
                EVMUtilityVersion.V2
            );
        });

        // it("mainnet", async () => {
        //     const data = readData("astra", "tx")
        //     await verifyAllLogs(mpt, data.block, data.receipts, data.transactionIndex, OutboundProofType.MPT, EVMUtilityVersion.V1)
        //     await verifyAllLogs(mptV2, data.block, data.receipts, data.transactionIndex, OutboundProofType.MPT, EVMUtilityVersion.V2)
        // })
    });
});
