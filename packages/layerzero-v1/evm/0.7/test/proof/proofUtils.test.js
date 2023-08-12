const { expect } = require('chai');
const { readData, getFirstLayerZeroPacketLogIndex } = require('../../utils/proof');
const { ethers } = require('hardhat');
const { proofUtils } = require('@layerzerolabs/lz-proof-utility');

describe('ProofUtils', () => {
    describe('getPacket V1', function () {
        let packetDecoder;
        const srcEndpointId = 2;
        const ulnAddress = '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675';
        const addressSize = 20;

        before(async function () {
            const MPT = await ethers.getContractFactory('MPTValidatorV4');
            packetDecoder = await MPT.deploy(
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
                1,
                ethers.constants.AddressZero
            );
        });

        it('omniCounter', async function () {
            const data = readData('bsc', 'omniCounter');

            const logIndex = getFirstLayerZeroPacketLogIndex(data.receipts[data.transactionIndex], ulnAddress);
            const log = data.receipts[data.transactionIndex].logs[logIndex];

            const packet = proofUtils.getLayerZeroPacket(srcEndpointId, log);

            const contractPacket = await packetDecoder.getPacket(
                log.data,
                srcEndpointId,
                addressSize,
                ethers.utils.defaultAbiCoder.encode(['address'], [log.address])
            );

            expect(packet.dstChainId).to.equal(contractPacket.dstChainId);
            expect(packet.srcChainId).to.equal(contractPacket.srcChainId);
            expect(packet.nonce).to.equal(contractPacket.nonce.toNumber());
            expect(packet.dstAddress).to.equal(contractPacket.dstAddress.toLowerCase());
            expect(packet.srcAddress).to.equal(contractPacket.srcAddress.toLowerCase());
            expect(packet.ulnAddress).to.equal(contractPacket.ulnAddress.toLowerCase());
            expect(packet.payload).to.equal(contractPacket.payload);
        });

        it('stargateSwap', async function () {
            const data = readData('bsc', 'stargateSwap');

            const logIndex = getFirstLayerZeroPacketLogIndex(data.receipts[data.transactionIndex], ulnAddress);
            const log = data.receipts[data.transactionIndex].logs[logIndex];

            const packet = proofUtils.getLayerZeroPacket(srcEndpointId, log);

            const contractPacket = await packetDecoder.getPacket(
                log.data,
                srcEndpointId,
                addressSize,
                ethers.utils.defaultAbiCoder.encode(['address'], [log.address])
            );

            expect(packet.dstChainId).to.equal(contractPacket.dstChainId);
            expect(packet.srcChainId).to.equal(contractPacket.srcChainId);
            expect(packet.nonce).to.equal(contractPacket.nonce.toNumber());
            expect(packet.dstAddress).to.equal(contractPacket.dstAddress.toLowerCase());
            expect(packet.srcAddress).to.equal(contractPacket.srcAddress.toLowerCase());
            expect(packet.ulnAddress).to.equal(contractPacket.ulnAddress.toLowerCase());
            expect(packet.payload).to.equal(contractPacket.payload);
        });
    });
});
