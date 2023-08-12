const { expect } = require('chai');
const { ethers } = require('hardhat');
const { readData, getFirstLayerZeroPacketLogIndex } = require('../../utils/proof');
const { proofUtils, EVMUtilityVersion, OutboundProofType } = require('@layerzerolabs/lz-proof-utility');

describe('MPT Validator V5', function () {
    let mpt;
    let data, rawProof, srcEndpointId, packetLogIndex;
    let outboundProofType, utilsVersion;
    const addressSize = 20;
    let ulnAddress;

    before(async function () {});

    describe('validateProof', function () {
        // requires forking bsc mainnet to test
        // FORKING=true yarn test test/mptV5.test.js
        it.skip('invalid relayer', async function () {
            srcEndpointId = 2;
            const MPT = await ethers.getContractFactory('MPTValidatorV5');
            const stargateBridgeAddress = '0x6694340fc020c5E6B96567843da2df01b2CE1eb6';
            const stgTokenAddress = '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b';
            const relayerAddress = '0xcb566e3B6934Fa77258d68ea18E931fa75e1aaAa'; //ethereum
            ulnAddress = '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675';
            mpt = await MPT.deploy(stargateBridgeAddress, stgTokenAddress, srcEndpointId, ulnAddress, relayerAddress);

            outboundProofType = OutboundProofType.MPT;
            utilsVersion = EVMUtilityVersion.V3;
            data = readData('bsc', 'omniCounter');
            packetLogIndex = getFirstLayerZeroPacketLogIndex(data.receipts[data.transactionIndex], ulnAddress);
            rawProof = await proofUtils.getReceiptProof(
                'default',
                data.block,
                data.receipts,
                data.transactionIndex,
                outboundProofType,
                utilsVersion
            );

            //todo: mock uln
            const packet = proofUtils.getLayerZeroPacket(
                srcEndpointId,
                data.receipts[data.transactionIndex].logs[packetLogIndex]
            );
            await expect(mpt.assertMessagePath(packet, data.block.hash, data.block.receiptsRoot)).to.be.revertedWith(
                'ProofLib: invalid relayer'
            );
        });

        // requires forking bsc mainnet to test
        // FORKING=true yarn test test/mptV5.test.js
        it.skip('valid relayer', async function () {
            srcEndpointId = 2;
            const MPT = await ethers.getContractFactory('MPTValidatorV5');
            const stargateBridgeAddress = '0x6694340fc020c5E6B96567843da2df01b2CE1eb6';
            const stgTokenAddress = '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b';
            const relayerAddress = '0xFe7C30860D01e28371D40434806F4A8fcDD3A098'; //bsc
            ulnAddress = '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675';
            mpt = await MPT.deploy(stargateBridgeAddress, stgTokenAddress, srcEndpointId, ulnAddress, relayerAddress);

            outboundProofType = OutboundProofType.MPT;
            utilsVersion = EVMUtilityVersion.V3;
            data = readData('bsc', 'omniCounter');
            packetLogIndex = getFirstLayerZeroPacketLogIndex(data.receipts[data.transactionIndex], ulnAddress);
            rawProof = await proofUtils.getReceiptProof(
                'default',
                data.block,
                data.receipts,
                data.transactionIndex,
                outboundProofType,
                utilsVersion
            );

            //todo: mock uln
            const packet = proofUtils.getLayerZeroPacket(
                srcEndpointId,
                data.receipts[data.transactionIndex].logs[packetLogIndex]
            );
            await expect(mpt.assertMessagePath(packet, data.block.hash, data.block.receiptsRoot)).to.not.be.reverted;
        });
    });
});
