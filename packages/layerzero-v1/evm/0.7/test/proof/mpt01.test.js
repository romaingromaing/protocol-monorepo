const { ethers } = require('hardhat');
const { readData, getFirstLayerZeroPacketLogIndex } = require('../../utils/proof');
const { expect } = require('chai');
const { proofUtils, OutboundProofType, EVMUtilityVersion } = require('@layerzerolabs/lz-proof-utility');

describe('MPT Validator 01', function () {
    let mpt, packetData;
    const addressSize = 20;

    before(async function () {
        const MPT = await ethers.getContractFactory('MPTValidator01');
        mpt = await MPT.deploy(ethers.constants.AddressZero, ethers.constants.AddressZero);
        const PacketData = await ethers.getContractFactory('PacketData');
        packetData = await PacketData.deploy();
    });

    describe('getPacket', function () {
        let nonce, srcChainId, srcAddress, ulnAddress, dstChainId, dstAddress, payload, encodedPayload;
        before(async function () {
            nonce = 135;
            srcChainId = 123;
            srcAddress = mpt.address;
            ulnAddress = ethers.constants.HashZero;
            dstChainId = 456;
            dstAddress = '0x123456789012345678901234567890abcdeabcde';
            payload = '0x123abc';
            encodedPayload = ethers.utils.solidityPack(
                ['uint64', 'uint16', 'address', 'uint16', 'bytes', 'bytes'],
                [nonce, srcChainId, srcAddress, dstChainId, dstAddress, payload]
            );
        });

        it('payload with bytes32 0 should revert', async function () {
            //this is a packet v1
            const tx = await packetData.emitPacketV1(nonce, srcAddress, dstChainId, dstAddress, payload);
            const receipt = await ethers.provider.send('eth_getTransactionReceipt', [tx.hash]);
            const logData = receipt.logs[0].data;

            await expect(mpt.getPacket(logData, addressSize, ulnAddress)).to.be.revertedWith(
                'LayerZeroPacket: invalid packet'
            );
        });

        it('ua payload should be decoded correctly', async function () {
            const tx = await packetData.emitPacketV2(nonce, srcChainId, srcAddress, dstChainId, dstAddress, payload);
            const receipt = await ethers.provider.send('eth_getTransactionReceipt', [tx.hash]);
            const logData = receipt.logs[0].data;

            const packet = await mpt.getPacket(logData, addressSize, ulnAddress);
            expect(packet.nonce).to.equal(nonce);
            expect(packet.srcChainId).to.equal(srcChainId);
            expect(packet.srcAddress).to.equal(srcAddress.toLowerCase());
            expect(packet.dstChainId).to.equal(dstChainId);
            expect(packet.dstAddress.toLowerCase()).to.equal(dstAddress);
            expect(packet.payload).to.equal(payload);
        });
    });

    describe('validateProof', function () {
        let outboundProofType, utilsVersion;
        let data, rawProof, packetLogIndex;
        const ulnAddress = '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675';

        before(async function () {
            outboundProofType = OutboundProofType.MPT;
            utilsVersion = EVMUtilityVersion.V4;
            data = readData('bsc', 'omniCounter'); //currently hacked with new topic
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

        it('unrecognized packet signature', async function () {
            const logIndex = 0; //not packet log
            const proof = proofUtils.encodeParams(rawProof, outboundProofType, utilsVersion, logIndex);
            await expect(mpt.validateProof(data.block.receiptsRoot, proof, addressSize)).to.be.revertedWith(
                'ProofLib: packet not recognized'
            );
        });

        it.skip('validate proof should work', async function () {
            //todo: missing a valid data set with new signature
            const logIndex = 1;
            const proof = proofUtils.encodeParams(rawProof, outboundProofType, utilsVersion, logIndex);
            await expect(mpt.validateProof(data.block.receiptsRoot, proof, addressSize)).to.not.be.reverted;
        });
    });

    describe('secure stargate', function () {});
});
