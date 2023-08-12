const { ethers } = require('hardhat');
const { proofUtils, OutboundProofType, EVMUtilityVersion } = require('@layerzerolabs/lz-proof-utility');
const { expect } = require('chai');
const Web3 = require('web3');
const web3 = new Web3();

describe('FP Validator', function () {
    let validator, packetData;
    const addressSize = 20;

    before(async function () {
        const FPValidator = await ethers.getContractFactory('FPValidator');
        validator = await FPValidator.deploy(ethers.constants.AddressZero, ethers.constants.AddressZero);
        const PacketData = await ethers.getContractFactory('PacketData');
        packetData = await PacketData.deploy();
    });

    describe('getPacket', function () {
        let nonce, srcChainId, srcAddress, ulnAddress, dstChainId, dstAddress, payload;
        before(async function () {
            nonce = 135;
            srcChainId = 123;
            srcAddress = validator.address;
            ulnAddress = ethers.constants.HashZero;
            dstChainId = 456;
            dstAddress = '0x123456789012345678901234567890abcdeabcde';
            payload = '0x123abc';
        });

        it('ua payload should be decoded correctly', async function () {
            const tx = await packetData.emitPacketV2(nonce, srcChainId, srcAddress, dstChainId, dstAddress, payload);
            const receipt = await ethers.provider.send('eth_getTransactionReceipt', [tx.hash]);
            const logData = web3.eth.abi.decodeParameter('bytes', receipt.logs[0].data);
            const packet = await validator.getPacket(logData, addressSize, ulnAddress);
            expect(packet.nonce).to.equal(nonce);
            expect(packet.srcChainId).to.equal(srcChainId);
            expect(packet.srcAddress).to.equal(srcAddress.toLowerCase());
            expect(packet.dstChainId).to.equal(dstChainId);
            expect(packet.dstAddress.toLowerCase()).to.equal(dstAddress);
            expect(packet.payload).to.equal(payload);
        });
    });

    describe('validateProof', function () {
        let outboundProofType,
            utilsVersion,
            nonce,
            srcChainId,
            srcAddress,
            ulnAddress,
            dstChainId,
            dstAddress,
            payload,
            rawProof;
        before(async function () {
            nonce = 135;
            srcChainId = 123;
            srcAddress = validator.address;
            ulnAddress = ethers.constants.HashZero;
            dstChainId = 456;
            dstAddress = '0x123456789012345678901234567890abcdeabcde';
            payload = '0x123abc';
            outboundProofType = OutboundProofType.FP;
            utilsVersion = EVMUtilityVersion.V1;

            const tx = await packetData.emitPacketV2(nonce, srcChainId, srcAddress, dstChainId, dstAddress, payload);
            const receipt = await ethers.provider.send('eth_getTransactionReceipt', [tx.hash]);
            const lzPacket = web3.eth.abi.decodeParameter('bytes', receipt.logs[0].data);
            const contractAddrByte32 = ethers.utils.hexZeroPad(receipt.logs[0].address, 32);
            rawProof = proofUtils.getFeatherProof(utilsVersion, contractAddrByte32, lzPacket);
        });

        it('validate proof should work', async function () {
            const proof = rawProof.proof;
            const packet = await validator.validateProof(web3.utils.keccak256(proof), proof, addressSize);
            expect(packet.nonce).to.equal(nonce);
            expect(packet.srcChainId).to.equal(srcChainId);
            expect(packet.srcAddress).to.equal(srcAddress.toLowerCase());
            expect(packet.dstChainId).to.equal(dstChainId);
            expect(packet.dstAddress.toLowerCase()).to.equal(dstAddress);
            expect(packet.payload).to.equal(payload);
        });
    });
});
