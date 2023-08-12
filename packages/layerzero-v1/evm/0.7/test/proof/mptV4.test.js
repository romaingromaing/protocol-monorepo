const { expect } = require('chai');
const { ethers } = require('hardhat');
const { readData, getFirstLayerZeroPacketLogIndex } = require('../../utils/proof');
const { proofUtils, OutboundProofType, EVMUtilityVersion } = require('@layerzerolabs/lz-proof-utility');

describe('MPT Validator V4', function () {
    let mpt;
    let data, rawProof, srcEndpointId, packetLogIndex;
    let outboundProofType, utilsVersion;
    const addressSize = 20;
    let ulnAddress;

    before(async function () {
        srcEndpointId = 2;
        const MPT = await ethers.getContractFactory('MPTValidatorV4');
        const stargateBridgeAddress = '0x6694340fc020c5E6B96567843da2df01b2CE1eb6';
        const stgTokenAddress = '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b';
        ulnAddress = '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675';
        mpt = await MPT.deploy(stargateBridgeAddress, stgTokenAddress, srcEndpointId, ulnAddress);

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
    });

    describe('validateProof', function () {
        it('unrecognized packet signature', async function () {
            const logIndex = 0; //not packet log
            const proof = proofUtils.encodeParams(rawProof, outboundProofType, utilsVersion, logIndex, srcEndpointId);
            await expect(mpt.validateProof(data.block.receiptsRoot, proof, addressSize)).to.be.revertedWith(
                'ProofLib: packet not recognized'
            );
        });

        it('invalid destination chain id', async function () {
            const packet = proofUtils.getLayerZeroPacket(
                srcEndpointId,
                data.receipts[data.transactionIndex].logs[packetLogIndex]
            );
            packet.dstChainId = 9;
            await expect(mpt.assertMessagePath(packet, data.block.hash, data.block.receiptsRoot)).to.be.revertedWith(
                'ProofLib: invalid destination chain ID'
            );
        });

        // requires forking bsc mainnet to test
        // FORKING=true yarn test test/mptV4.test.js
        it.skip('invalid receipt root', async function () {
            //todo: mock uln
            const packet = proofUtils.getLayerZeroPacket(
                srcEndpointId,
                data.receipts[data.transactionIndex].logs[packetLogIndex]
            );
            const notReceiptRoot = data.block.hash;
            await expect(mpt.assertMessagePath(packet, data.block.hash, notReceiptRoot)).to.be.revertedWith(
                'ProofLib: invalid receipt root'
            );
        });

        it.skip('not enough block confirmations', async function () {
            //todo: mock oracle and test appconfig vs blockdata from oracle
            const packet = proofUtils.getLayerZeroPacket(
                srcEndpointId,
                data.receipts[data.transactionIndex].logs[packetLogIndex]
            );
            await expect(mpt.assertMessagePath(packet, data.block.hash, data.block.receiptsRoot)).to.be.revertedWith(
                'ProofLib: not enough block confirmations'
            );
        });
    });
});
