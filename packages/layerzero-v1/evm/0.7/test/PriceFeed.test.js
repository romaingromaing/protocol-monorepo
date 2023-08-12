const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');

const { getAddr } = require('../utils/helpers');

describe('PriceFeed', function () {
    let priceFeed;
    let relayerDeployer, proxyAdminDeployer;

    beforeEach(async function () {
        ({ relayerDeployer, proxyAdminDeployer } = await getAddr(ethers));
        await deployments.fixture(['test']);
        priceFeed = (await ethers.getContract('PriceFeed')).connect(relayerDeployer);
    });

    it('setPriceUpdater can set new price updater', async function () {
        const newPriceUpdater = '0x0000000000000000000000000000000000000001';
        await priceFeed.setPriceUpdater(newPriceUpdater, true);
        let isPriceUpdater = await priceFeed.priceUpdater('0x0000000000000000000000000000000000000001');

        expect(isPriceUpdater).equal(true);

        await priceFeed.setPriceUpdater(newPriceUpdater, false);
        isPriceUpdater = await priceFeed.priceUpdater('0x0000000000000000000000000000000000000001');

        expect(isPriceUpdater).equal(false);
    });

    it('setPriceRatioDenominator can change the denominator', async function () {
        const newDemoniator = 1e5;
        await priceFeed.setPriceRatioDenominator(newDemoniator);
        const denominator = await priceFeed.PRICE_RATIO_DENOMINATOR();

        expect(denominator).equal(newDemoniator);
    });

    it('setArbitrumCompressionPercent can change the compression percent', async function () {
        const newCompressionPercent = 51;
        await priceFeed.setArbitrumCompressionPercent(newCompressionPercent);
        const compressionPercent = await priceFeed.ARBITRUM_COMPRESSION_PERCENT();

        expect(newCompressionPercent).equal(compressionPercent);
    });

    describe('setPrice', function () {
        it('setPrice works', async function () {
            const chainId = 0x65; // 101
            const priceRatio = 0x33;
            const gasPriceInUnit = 0x44;
            const gasPerByte = 0x55;

            await priceFeed['setPrice((uint16,(uint128,uint64,uint32))[])']([
                {
                    chainId,
                    price: { priceRatio, gasPriceInUnit, gasPerByte },
                },
            ]);

            const rv = await priceFeed.getPrice(chainId);
            expect(rv.priceRatio).equal(priceRatio);
            expect(rv.gasPriceInUnit).equal(gasPriceInUnit);
            expect(rv.gasPerByte).equal(gasPerByte);
        });

        it('setPriceForArbitrum works', async function () {
            const chainId = 110;
            const priceRatio = 0x33;
            const l2GasPriceInUnit = 0x44;
            const gasPerL2Tx = 0x55;
            const gasPerL1CallDataByte = 0x66;

            await priceFeed['setPriceForArbitrum((uint16,(uint128,uint64,uint32),(uint64,uint32))[])']([
                {
                    chainId: chainId,
                    price: { priceRatio, gasPriceInUnit: l2GasPriceInUnit, gasPerByte: gasPerL1CallDataByte },
                    extend: { gasPerL2Tx, gasPerL1CallDataByte },
                },
            ]);

            const rv = await priceFeed.getPrice(chainId);
            expect(rv.priceRatio).equal(priceRatio);
            expect(rv.gasPriceInUnit).equal(l2GasPriceInUnit);
            expect(rv.gasPerByte).equal(gasPerL1CallDataByte);
        });
    });

    it('estimateCostByChain with callData', async function () {
        const ABI = [
            'function validateBlock(uint16 _srcChainId, bytes32 _lookupHash, uint _confirmations, bytes32 _data)',
        ];
        const iface = new ethers.utils.Interface(ABI);
        const funcSigHash = iface.getSighash('validateBlock');
        const callData = iface.encodeFunctionData('validateBlock', [
            110,
            '0xcee40cfb25c3dc133024a8917429197c4d2534b3b9acb58ee985984ef00544bd',
            20,
            '0xab2b0968b329a825fc57bf68efebb45ff233bbaf98ca087ea05f4cabf8ed91ef',
        ]);
        const callDataSize = callData.slice(2).length / 2;
        const funcSigHashSize = funcSigHash.slice(2).length / 2;
        const paramSize = 32 * 4;

        await expect(callDataSize === funcSigHashSize + paramSize).to.be.true;

        const [priceRatio, gasPriceInUnit, gasPerByte] = [10600000001, 12466691285, 16];
        await priceFeed['setPrice((uint16,(uint128,uint64,uint32))[])']([
            {
                chainId: 111,
                price: { priceRatio, gasPriceInUnit, gasPerByte },
            },
        ]);

        const price = await priceFeed.getPrice(111);
        expect(price.priceRatio).equal(priceRatio);
        expect(price.gasPriceInUnit).equal(gasPriceInUnit);

        const cost = await priceFeed.estimateFeeByChain(111, 0, 3064);
        expect(cost.fee).to.equal('40489818626894');
    });

    describe('estimateCostByChain', function () {
        const [priceRatio, gasPriceInUnit, gasPerByte] = [10000000000, 10000000000, 1];
        const [arbGasPerL2Tx, arbGasPerL1CallDataByte] = [50000, 10];
        const arbCompressionRatio = 47;
        const priceRatioDenominator = 1e10;
        beforeEach(async function () {
            await priceFeed['setPrice((uint16,(uint128,uint64,uint32))[])']([
                {
                    chainId: 101,
                    price: { priceRatio, gasPriceInUnit, gasPerByte },
                },
            ]);
            await priceFeed['setPriceForArbitrum((uint16,(uint128,uint64,uint32),(uint64,uint32))[])']([
                {
                    chainId: 110,
                    price: { priceRatio, gasPriceInUnit, gasPerByte },
                    extend: { gasPerL2Tx: arbGasPerL2Tx, gasPerL1CallDataByte: arbGasPerL1CallDataByte },
                },
            ]);
            await priceFeed['setPrice((uint16,(uint128,uint64,uint32))[])']([
                {
                    chainId: 111,
                    price: { priceRatio, gasPriceInUnit, gasPerByte },
                },
            ]);
        });

        it('works with default evms', async function () {
            const dstChainId = 101;
            const callDataSize = 1000;
            const gas = 100000;
            const cost = await priceFeed.estimateFeeByChain(dstChainId, callDataSize, gas);

            const gasForCallData = callDataSize * gasPerByte;
            const remoteFee = (gas + gasForCallData) * gasPriceInUnit;
            const fee = Math.floor((remoteFee * priceRatio) / priceRatioDenominator);

            expect(cost.fee.toString()).to.equal(fee.toString());
        });

        it('works with arbitrum', async function () {
            const dstChainId = 110;
            const callDataSize = 1000;
            const gas = 100000;
            const cost = await priceFeed.estimateFeeByChain(dstChainId, callDataSize, gas);

            const gasForL1CallData = ((callDataSize * arbCompressionRatio) / 100) * arbGasPerL1CallDataByte;
            const gasForL2CallData = callDataSize * gasPerByte;
            const fee = (gas + arbGasPerL2Tx + gasForL1CallData + gasForL2CallData) * gasPriceInUnit;

            expect(cost.fee.toString()).to.equal(fee.toString());
        });

        it('works with optimism', async function () {
            const dstChainId = 111;
            const callDataSize = 1000;
            const gas = 100000;
            const optimismOverhead = 3188;
            const cost = await priceFeed.estimateFeeByChain(dstChainId, callDataSize, gas);

            const gasForL1CallData = callDataSize * gasPerByte + optimismOverhead;
            const l1Fee = gasForL1CallData * gasPriceInUnit;
            const gasForL2CallData = callDataSize * gasPerByte;
            const l2Fee = (gasForL2CallData + gas) * gasPriceInUnit;

            const l1FeeInSrcPrice = Math.floor((l1Fee * priceRatio) / priceRatioDenominator);
            const l2FeeInSrcPrice = Math.floor((l2Fee * priceRatio) / priceRatioDenominator);
            const fee = l1FeeInSrcPrice + l2FeeInSrcPrice;

            expect(cost.fee.toString()).to.equal(fee.toString());
        });
    });
});
