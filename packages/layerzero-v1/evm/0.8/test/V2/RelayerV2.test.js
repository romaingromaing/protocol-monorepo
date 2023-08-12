const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');

const { ZERO_ADDRESS } = require('../../../0.7/utils/constants');
const { VARS } = require('../../../0.7/utils/constants');
const {
    getAddr,
    encodeParams,
    encodePackedParams,
    deployNew,
    getRatioAndPriceType1,
    getRatioAndPriceType2,
} = require('../../../0.7/utils/helpers');

describe('RelayerV2:', function () {
    let denominator = 1e20;
    let deployer, relayer, priceFeed, ultraLightNode, user1, badUser1, fakeContract;
    let relayerDeployer, proxyAdminDeployer;
    let {
        chainId,
        outboundProofType,
        payloadLength,
        txType,
        txType2,
        extraGas,
        dstNativeCap,
        dstGasPrice,
        baseGas,
        gasPerByte,
        txParams,
        multiplierDenominator,
    } = VARS;

    before(async function () {
        ({ deployer, badUser1, user1, fakeContract, relayerDeployer, proxyAdminDeployer } = await getAddr(ethers));
    });

    beforeEach(async function () {
        await deployments.fixture(['test']);

        relayer = (await ethers.getContract('RelayerV2')).connect(relayerDeployer);
        const PriceFeed = await ethers.getContractFactory('PriceFeedV2Mock');
        priceFeed = await PriceFeed.connect(relayerDeployer).deploy();
        await priceFeed.initialize(deployer.address);
        await relayer.setPriceFeed(priceFeed.address);

        ultraLightNode = await ethers.getContract('UltraLightNodeV2');
    });

    it('upgrade() - only allow upgrade by admin', async function () {
        expect(await relayer.approvedAddresses(user1.address)).to.be.false; // inits to false

        // approve for user1
        await relayer.connect(relayerDeployer).setApprovedAddress(user1.address, true);
        expect(await relayer.approvedAddresses(user1.address)).to.be.true;

        // deploy a relayer v2
        const proxyAdmin = await ethers.getContract('DefaultProxyAdmin');
        const relayerV1Addr = await proxyAdmin.getProxyImplementation(relayer.address);
        const relayerV2 = await deployNew('RelayerV2');

        // reverts when called by non proxy owner
        await expect(
            proxyAdmin.connect(relayerDeployer).upgrade(relayer.address, relayerV2.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');

        // deploys new implementation
        await proxyAdmin.connect(proxyAdminDeployer).upgrade(relayer.address, relayerV2.address);
        expect(relayerV1Addr).to.not.equal(await proxyAdmin.getProxyImplementation(relayer.address));

        expect(await relayer.approvedAddresses(user1.address)).to.be.true; // user1 remains approved
    });

    it('constructor() - created / is approved', async function () {
        expect(await relayer.isApproved(relayer.address)).to.equal(true);
    });

    it('setApprovedAddress() - reverts with non owner', async function () {
        await expect(relayer.connect(badUser1).setApprovedAddress(user1.address, true)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('withdrawFee() reverts with unapproved', async function () {
        await expect(relayer.connect(user1).withdrawFee(user1.address, 1)).to.be.revertedWith('Relayer: not approved');
    });

    it('withdrawFee() - reverts from non owner', async function () {
        await expect(relayer.connect(badUser1).withdrawFee(badUser1.address, 1)).to.revertedWith(
            'Relayer: not approved'
        );
    });

    it('withdrawFee() - reverts if amount is greater than total fee', async function () {
        const amountToWithdraw = await ultraLightNode.accruedNativeFee(relayer.address);
        await expect(relayer.withdrawFee(user1.address, amountToWithdraw + 1)).to.revertedWith(
            'Relayer: not enough fee for withdrawal'
        );
    });

    it('assignJob() - reverts from non uln', async function () {
        const ulnAddress = await relayer.uln();
        expect(ulnAddress).to.not.be.equal(badUser1);
        await expect(
            relayer.connect(badUser1).assignJob(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)
        ).to.revertedWith('Relayer: invalid uln');
    });

    it('setPause() - reverts with non owner', async function () {
        await expect(relayer.connect(badUser1).setPause(true)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('setPause()', async function () {
        expect(await relayer.paused()).to.equal(false);
        await relayer.setPause(true);
        expect(await relayer.paused()).to.equal(true);
        await relayer.setPause(false);
        expect(await relayer.paused()).to.equal(false);
    });

    it('setStargateAddress() - reverts with unapproved', async function () {
        await expect(relayer.connect(badUser1).setStargateAddress(fakeContract.address)).to.revertedWith(
            'Relayer: not approved'
        );
    });

    it('setStargateAddress() - reverts with unapproved', async function () {
        await relayer.setStargateAddress(fakeContract.address);
        expect(await relayer.stargateBridgeAddress()).to.equal(fakeContract.address);
    });

    it('setDstPrice() - reverts with unapproved', async function () {
        await expect(relayer.connect(badUser1).setDstPrice(chainId, 1, dstGasPrice)).to.revertedWith(
            'Relayer: not approved'
        );
    });

    it('setDstConfig() - reverts with unapproved', async function () {
        await expect(
            relayer.connect(badUser1).setDstConfig(chainId, outboundProofType, dstNativeCap, baseGas, gasPerByte)
        ).to.revertedWith('Relayer: not approved');
    });

    it('setApprovedAddress() - set / emits event', async function () {
        await expect(relayer.setApprovedAddress(user1.address, true)).to.emit(relayer, 'ApproveAddress');
        expect(await relayer.isApproved(user1.address));
    });

    it('setDstPrice() - set', async function () {
        const { dstPriceRatio } = getRatioAndPriceType1();
        await relayer.setDstPrice(chainId, dstPriceRatio.toString(), dstGasPrice); //does nothing

        const { dstPriceRatio: _dstPriceRatio, dstGasPriceInWei: _dstGasPrice } = await relayer.dstPriceLookupOld(
            chainId
        );
        expect(_dstPriceRatio).to.equal(0);
        expect(_dstGasPrice).to.equal(0);
    });

    it('setDstConfig() - set', async function () {
        await relayer.setDstConfig(chainId, outboundProofType, dstNativeCap, baseGas, gasPerByte);

        const config = await relayer.dstConfigLookup(chainId, outboundProofType);
        expect(config.dstNativeAmtCap).to.equal(dstNativeCap);
        expect(config.baseGas).to.equal(baseGas);
        expect(config.gasPerByte).to.equal(gasPerByte);
    });

    describe('setDstPriceMultipliers()', function () {
        const chainId = 101;
        const multiplier = 10000;
        const multipliers = [{ chainId, multiplier }];

        it('reverts when not price config updater', async function () {
            await expect(relayer.connect(badUser1).setDstPriceMultipliers(multipliers)).to.revertedWith(
                'Relayer: not updater'
            );
        });

        it('set', async function () {
            await relayer.setPriceConfigUpdater(user1.address, true);
            await relayer.connect(user1).setDstPriceMultipliers(multipliers);

            expect(await relayer.dstMultipliers(chainId)).to.equal(multiplier);
        });
    });

    describe('setDstFloorMarginsUSD()', function () {
        const chainId = 101;
        const floorMargin = ethers.utils.parseUnits('0.3', 10);
        const margins = [{ chainId, floorMargin }];

        it('reverts when not price config updater', async function () {
            await expect(relayer.connect(badUser1).setDstFloorMarginsUSD(margins)).to.revertedWith(
                'Relayer: not updater'
            );
        });

        it('set', async function () {
            await relayer.setPriceConfigUpdater(user1.address, true);
            await relayer.connect(user1).setDstFloorMarginsUSD(margins);

            expect(await relayer.dstFloorMarginsUSD(chainId)).to.equal(floorMargin);
        });
    });

    it('getFee() - reverts when paused', async function () {
        await relayer.setPause(true);
        const txParams = encodePackedParams(['uint16', 'uint'], [txType, extraGas]);
        await expect(
            relayer['getFee(uint16,uint16,address,uint256,bytes)'](chainId, 1, ZERO_ADDRESS, 0, txParams)
        ).to.be.revertedWith('Admin: paused');
    });

    it('getFee() - reverts with invalid txParams', async function () {
        // encoded with the wrong size != 34 && < 66
        let txParams = encodePackedParams(['uint16', 'uint'], [1, 1]);
        // tamper it
        txParams = '0x0001' + txParams.split('0x')[1];

        await expect(txParams.length).to.equal((2 + 32) * 2 + 2 + 4);
        await expect(relayer.getFee(chainId, 1, ZERO_ADDRESS, 0, txParams)).to.be.revertedWith(
            'Relayer: wrong _adapterParameters size'
        );
    });

    it('getFee() - reverts with unsupported type', async function () {
        // encoded with the wrong size >= 66
        const txParams = encodeParams(
            ['uint16', 'uint', 'uint', 'address'],
            [1, 1, 1, '0x0000000000000000000000000000000000000001']
        );
        expect(txParams.length).to.equal(32 * 4 * 2 + 2);
        await expect(relayer.getFee(1, 1, ZERO_ADDRESS, 0, txParams)).to.be.revertedWith('Relayer: unsupported txType');
    });

    it('getFee() - reverts with bad tx types', async function () {
        const txParams = encodePackedParams(['uint16', 'uint'], [0, 1]);
        await expect(relayer.getFee(1, 1, ZERO_ADDRESS, 0, txParams)).to.be.revertedWith('Relayer: unsupported txType');
    });

    it('getFee() - reverts with not enough gas', async function () {
        const txParams = encodePackedParams(['uint16', 'uint'], [1, 0]);
        await expect(relayer.getFee(1, 1, ZERO_ADDRESS, 0, txParams)).to.be.revertedWith('Relayer: gas too low');
    });

    describe('getFee() - adapterParams V1', function () {
        const txParams = encodePackedParams(['uint16', 'uint'], [txType, extraGas]);
        const gasPriceInUnit = 10;
        const priceRatio = 2;
        const floorMargin = 0.003 * denominator;
        let validateProofBytes;
        let mptOverhead;
        let feeByChain;

        beforeEach(async function () {
            validateProofBytes = await relayer.validateProofBytes();
            mptOverhead = await relayer.mptOverhead();

            await relayer.setDstConfig(chainId, outboundProofType, dstNativeCap, baseGas, gasPerByte);
            await priceFeed.setPrice([
                {
                    eid: chainId,
                    price: { priceRatio: (priceRatio * denominator).toString(), gasPriceInUnit, gasPerByte },
                },
            ]);

            const callDataSize = payloadLength + validateProofBytes + mptOverhead;
            feeByChain = (await priceFeed.estimateFeeByEid(chainId, callDataSize, baseGas + extraGas))[0].toNumber();
        });

        it('returns 0 fees if transaction fees not set', async function () {
            await priceFeed.setPrice([
                {
                    eid: chainId,
                    price: { priceRatio: 0, gasPriceInUnit, gasPerByte },
                },
            ]);

            expect(await relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)).to.equal(0);
        });

        it('default multiplier - returns correct fee * defaultMultiplier', async function () {
            const defaultMultiplier = (await relayer.multiplierBps()) / multiplierDenominator;
            const expectedFee = feeByChain * defaultMultiplier;

            expect(await relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)).to.equal(
                expectedFee
            );
        });

        it('chain specific multiplier - returns fee * multiplier', async function () {
            const multiplier = 1.1;
            const expectedFee = feeByChain * multiplier;
            await relayer.setDstPriceMultipliers([{ chainId, multiplier: multiplier * multiplierDenominator }]);

            expect(await relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)).to.equal(
                expectedFee
            );
        });

        it('floor margin USD - no native token price USD - returns fee * multiplier', async function () {
            const multiplier = 1.1;
            const expectedFee = feeByChain * multiplier;
            await relayer.setDstPriceMultipliers([{ chainId, multiplier: multiplier * multiplierDenominator }]);
            await relayer.setDstFloorMarginsUSD([{ chainId, floorMargin: floorMargin.toString() }]);

            expect(await relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)).to.equal(
                expectedFee
            );
        });

        it('floor margin USD - native token price USD - returns floor margin + fee', async function () {
            const multiplier = 1.1;
            const nativeTokenPriceUSD = ethers.BigNumber.from(2100).mul(denominator.toString());
            const floorMarginInNative = ethers.utils.parseEther((0.003 / 2100).toFixed(18)); // take out denominator to avoid javascript overflow
            const expectedFee = feeByChain + floorMarginInNative.toNumber();

            await priceFeed.setNativeTokenPriceUSD(nativeTokenPriceUSD);
            await relayer.setDstPriceMultipliers([{ chainId, multiplier: multiplier * multiplierDenominator }]);
            await relayer.setDstFloorMarginsUSD([{ chainId, floorMargin: floorMargin.toString() }]);

            expect(await relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)).to.equal(
                expectedFee
            );
        });
    });

    describe('getFee() - adapterParams V2', function () {
        const txParams = encodePackedParams(
            ['uint16', 'uint', 'uint', 'address'],
            [txType2, extraGas, dstNativeCap, ZERO_ADDRESS]
        );
        const gasPriceInUnit = 10;
        const priceRatio = 2;
        const floorMargin = 0.003 * denominator;
        let validateProofBytes;
        let mptOverhead;
        let feeByChain;

        beforeEach(async function () {
            validateProofBytes = await relayer.validateProofBytes();
            mptOverhead = await relayer.mptOverhead();

            await relayer.setDstConfig(chainId, outboundProofType, dstNativeCap, baseGas, gasPerByte);
            await priceFeed.setPrice([
                {
                    eid: chainId,
                    price: { priceRatio: (priceRatio * denominator).toString(), gasPriceInUnit, gasPerByte },
                },
            ]);

            const callDataSize = payloadLength + validateProofBytes + 32 + mptOverhead;
            feeByChain = (await priceFeed.estimateFeeByEid(chainId, callDataSize, baseGas + extraGas))[0].toNumber();
        });

        it('reverts with "dstNativeAmt too large"', async function () {
            // set the cap 1 lower than the requested amount
            await relayer.setDstConfig(chainId, outboundProofType, dstNativeCap - 1, baseGas, gasPerByte);

            await expect(
                relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)
            ).to.be.revertedWith('Relayer: dstNativeAmt too large');
        });

        it('default multiplier - returns fee * defaultMultiplier', async function () {
            const defaultMultiplier = (await relayer.multiplierBps()) / multiplierDenominator;
            const airdropAmount = dstNativeCap * priceRatio * defaultMultiplier;
            const txFee = feeByChain * defaultMultiplier;
            const expectedFee = txFee + airdropAmount;

            expect(await relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)).to.equal(
                expectedFee
            );
        });

        it('floor margin USD - native token price USD - returns floor margin + fee', async function () {
            const multiplier = 1.1;
            const nativeTokenPriceUSD = ethers.BigNumber.from(2100).mul(denominator.toString());
            const defaultMultiplier = (await relayer.multiplierBps()) / multiplierDenominator;
            const airdropAmount = dstNativeCap * priceRatio * defaultMultiplier;
            const floorMarginInNative = ethers.utils.parseEther((0.003 / 2100).toFixed(18));

            const expectedFee = feeByChain + floorMarginInNative.toNumber() + airdropAmount;

            await priceFeed.setNativeTokenPriceUSD(nativeTokenPriceUSD);
            await relayer.setDstPriceMultipliers([{ chainId, multiplier: multiplier * multiplierDenominator }]);
            await relayer.setDstFloorMarginsUSD([{ chainId, floorMargin: floorMargin.toString() }]);

            expect(await relayer.getFee(chainId, outboundProofType, ZERO_ADDRESS, payloadLength, txParams)).to.equal(
                expectedFee
            );
        });
    });
});
