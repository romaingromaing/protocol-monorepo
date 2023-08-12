const { ethers } = require('hardhat');
const { expect } = require('chai');
const Web3 = require('web3');
const web3 = new Web3();

describe('test packet codec', () => {
    describe('LayerZeroPacket', () => {
        let validator;
        before(async () => {
            const MPT = await await ethers.getContractFactory('MPTValidatorV4');
            validator = await MPT.deploy(
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
                1,
                ethers.constants.AddressZero
            );
        });

        it('get packet with ua payload', async () => {
            //uint64 nonce, uint16 srcChainId, address srcAddress, uint16 dstChainId, bytes memory dstAddress, bytes memory payload
            let nonce = 135;
            let srcChainId = 123;
            let srcAddress = validator.address;
            let dstChainId = 456;
            let dstAddress = '0x123456789012345678901234567890abcdeabcde';
            let uaPayload = '0x123abc';
            const encodedPayload = ethers.utils.solidityPack(
                ['uint64', 'address', 'bytes', 'bytes'],
                [nonce, srcAddress, dstAddress, uaPayload]
            );
            const payload = web3.eth.abi.encodeParameters(['uint16', 'bytes'], [dstChainId, encodedPayload]);

            const packet = await validator.getPacket(payload, srcChainId, 20, ethers.constants.HashZero);
            expect(packet.nonce).to.equal(nonce);
            expect(packet.srcChainId).to.equal(srcChainId);
            expect(packet.srcAddress).to.equal(srcAddress.toLowerCase());
            expect(packet.dstChainId).to.equal(dstChainId);
            expect(packet.dstAddress.toLowerCase()).to.equal(dstAddress);
            expect(packet.payload).to.equal(uaPayload);
        });

        it('get packet from full payload', async () => {
            const payload =
                '0x0000000000000000000000000000000000000000000000000000000000004e22000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000300000000000000035d0cb5f23a68f9a5a44ff4365cc3d84287b46237fd0cb5f23a68f9a5a44ff4365cc3d84287b46237f00000000000000000000000000000000';
            const by = '0x0000000000000000000000000000000000000000000000000000000000004e22';
            const packet = await validator.getPacket(payload, 1, 20, by);
            expect(packet.dstChainId).to.equal(20002);
            expect(packet.nonce).to.equal(53);
            expect(packet.srcAddress.toLowerCase()).to.equal('0xd0cb5f23a68f9a5a44ff4365cc3d84287b46237f');
            expect(packet.dstAddress.toLowerCase()).to.equal('0xd0cb5f23a68f9a5a44ff4365cc3d84287b46237f');
            expect(packet.payload).to.equal('0x');
        });
    });
});
