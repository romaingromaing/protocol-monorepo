const { ethers, deployments } = require('hardhat');
const { expect } = require('chai');

describe('test packet codec', () => {
    describe('LayerZeroPacket', () => {
        let validator;
        before(async () => {
            await deployments.fixture(['FPValidator']);
            validator = await ethers.getContract('FPValidator');
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
                ['uint64', 'uint16', 'address', 'uint16', 'bytes', 'bytes'],
                [nonce, srcChainId, srcAddress, dstChainId, dstAddress, uaPayload]
            );

            const packet = await validator.getPacket(encodedPayload, 20, ethers.constants.HashZero);
            expect(packet.nonce).to.equal(nonce);
            expect(packet.srcChainId).to.equal(srcChainId);
            expect(packet.srcAddress).to.equal(srcAddress.toLowerCase());
            expect(packet.dstChainId).to.equal(dstChainId);
            expect(packet.dstAddress.toLowerCase()).to.equal(dstAddress);
            expect(packet.payload).to.equal(uaPayload);
        });

        it('get packet from full payload', async () => {
            const payload =
                '0x0000000000000087007bae92d5ad7583ad66e49a0c67bad18f6ba52dddc101c8123456789012345678901234567890abcdeabcde123abc';
            const by = '0x0000000000000000000000000000000000000000000000000000000000004e22';
            const packet = await validator.getPacket(payload, 20, by);
            expect(packet.dstChainId).to.equal(456);
            expect(packet.nonce).to.equal(135);
            expect(packet.srcAddress.toLowerCase()).to.equal('0xae92d5ad7583ad66e49a0c67bad18f6ba52dddc1');
            expect(packet.dstAddress.toLowerCase()).to.equal('0x123456789012345678901234567890abcdeabcde');
            expect(packet.payload).to.equal('0x123abc');
        });
    });
});
