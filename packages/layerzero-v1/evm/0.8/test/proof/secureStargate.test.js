const { expect } = require('chai');
const { ethers } = require('hardhat');

const { logger } = require('../../../0.7/utils/proof');

describe('Secure Stargate:', () => {
    let validator, signers, owner, alice, normalSwapLength, token, TYPE_SWAP_REMOTE, TYPE_ADD_LIQUIDITY;

    before(async () => {
        signers = await ethers.getSigners();
        owner = signers[0];
        alice = signers[1];
        normalSwapLength = 544;
        TYPE_SWAP_REMOTE = 1;
        TYPE_ADD_LIQUIDITY = 2;

        await deployments.fixture(['FPValidator']);

        validator = await ethers.getContract('FPValidator');
        token = await (await ethers.getContractFactory('Token')).deploy();
        // tokenDestructed = await (await ethers.getContractFactory("Token")).deploy()
        // await tokenDestructed.selfDestruct()
    });

    const numOfBytes = (bytesString) => {
        return bytesString.slice(2).length / 2;
    };

    // TYPE REMOTE SWAP
    // bytes memory payload = "";
    // Pool.CreditObj memory c = Pool.CreditObj(1, 1);
    // if (_functionType == TYPE_SWAP_REMOTE) {
    //     Pool.SwapObj memory s = Pool.SwapObj(1, 1, 1, 1, 1, 1);
    //     payload = abi.encode(TYPE_SWAP_REMOTE, 0, 0, 0, c, s, _toAddress, _transferAndCallPayload);

    it('secureStgPayload() - payload is not modified if length is 544 or less and to address is contract', async () => {
        const toAddress = token.address; // a contract address
        const payload = '0x';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length shouldnt have been modified
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));
        // should be length of 544
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength);
        // should not have changed any values
        expect(swapPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - payload is not modified if length is 544 or less and to address is a wallet', async () => {
        const toAddress = alice.address; // a wallet address
        const payload = '0x';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length shouldnt have been modified
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));
        // should be length of 544
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength);
        // should not have changed any values
        expect(swapPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - payload length > 544 and to address is a contract', async () => {
        const toAddress = token.address; // a contractt address
        const payload = '0x0000000000000000000000000000000000000000000000000000000000001234';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length shouldnt have been modified
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));
        // should be equal to original payload length,
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength + numOfBytes(payload));
        // should not have changed any values
        expect(swapPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - payload length > 544 and to address is NOT a contract', async () => {
        const toAddress = alice.address; // a wallet address
        const payload = '0x0000000000000000000000000000000000000000000000000000000000001234';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length should have been modified
        expect(numOfBytes(swapPayload)).to.not.equal(numOfBytes(securePayload));
        // should be length of 544 because the payload was removed
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength);

        // should have removed the payload and not modified anything else
        const expectedPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, '0x']
        );

        expect(expectedPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - payload length > 544 and to address is a contract that has selfDestruct()', async () => {
        const toAddress = alice.address; // a token address that has been self-destructed
        const payload = '0x0000000000000000000000000000000000000000000000000000000000001234';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length should have been modified
        expect(numOfBytes(swapPayload)).to.not.equal(numOfBytes(securePayload));
        // should be length of 544 because the payload was removed
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength);

        // should have removed the payload and not modified anything else
        const expectedPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, '0x']
        );

        expect(expectedPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - payload length > 544 and to address is NOT a contract, which has been made absurdly long', async () => {
        const toAddress = alice.address;
        // a wallet address
        const toAddressLong =
            toAddress +
            '98347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809';
        const payload = '0x0000000000000000000000000000000000000000000000000000000000001234';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddressLong, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length should have been modified
        expect(numOfBytes(swapPayload)).to.not.equal(numOfBytes(securePayload));
        // should be length of 544 because the payload was removed
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength);

        // should have removed the payload and not modified anything else
        const expectedPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, '0x']
        );

        expect(expectedPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - payload length > 544 but function type is TYPE_ADD_LIQUIDITY, packet is unchanged', async () => {
        const toAddress = alice.address; // a wallet address
        const toAddressLong =
            toAddress +
            '98347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            ['uint8', 'uint256', 'uint256', 'creditObj(uint256,uint256)', 'bytes'],
            [TYPE_ADD_LIQUIDITY, 2, 3, [4, 5], toAddressLong]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length should remain the same
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));
        expect(numOfBytes(swapPayload)).to.gt(normalSwapLength);
        // packet is unchanged
        expect(swapPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - bytes toAddress is 0x so payload length is 544', async () => {
        const toAddress = '0x';
        const payload = '0x1122';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length should not have been modified
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));
        // should be length of 544 because the payload was removed
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength);

        // should have removed the payload and set address to 0x0
        const expectedPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], ethers.constants.AddressZero, '0x']
        );

        expect(expectedPayload).to.equal(securePayload);
    });

    it('secureStgPayload() - bytes toAddress is 0x and payload is 0x0, length is 512', async () => {
        const toAddress = '0x';
        const payload = '0x';

        // generate a TYPE_SWAP_REMOTE payload
        const swapPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], toAddress, payload]
        );
        const securePayload = await validator.secureStgPayload(swapPayload);

        // payload length should not have been modified
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));
        // should be length of 544 because the payload was removed
        expect(numOfBytes(securePayload)).to.equal(normalSwapLength - 32);

        // should have removed the payload and set address to 0x0
        const expectedPayload = ethers.utils.defaultAbiCoder.encode(
            [
                'uint8',
                'uint256',
                'uint256',
                'uint256',
                'creditObj(uint256,uint256)',
                'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)',
                'bytes',
                'bytes',
            ],
            [TYPE_SWAP_REMOTE, 2, 3, 4, [5, 6], [7, 8, 9, 10, 11, 12], '0x', '0x']
        );

        expect(expectedPayload).to.equal(securePayload);
    });

    it('secureStgTokenPayload() - bytes toAddress is 0x', async () => {
        const toAddress = ethers.constants.AddressZero;
        const qty = 123;
        const burnAddress = '0x000000000000000000000000000000000000dEaD';

        const swapPayload = ethers.utils.defaultAbiCoder.encode(['bytes', 'uint256'], [toAddress, qty]);
        logger.debug(swapPayload);
        const securePayload = await validator.secureStgTokenPayload(swapPayload);
        logger.debug(securePayload);

        // payload length should not have been modified
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));

        // should have removed the payload and set address to 0xdead
        const expectedPayload = ethers.utils.defaultAbiCoder.encode(['bytes', 'uint256'], [burnAddress, qty]);

        expect(expectedPayload).to.equal(securePayload);
    });

    it('secureStgTokenPayload() - bytes toAddress is wallet', async () => {
        const toAddress = alice.address;
        const qty = 123;

        const swapPayload = ethers.utils.defaultAbiCoder.encode(['bytes', 'uint256'], [toAddress, qty]);
        const securePayload = await validator.secureStgTokenPayload(swapPayload);

        // payload length should not have been modified
        expect(numOfBytes(swapPayload)).to.equal(numOfBytes(securePayload));
        expect(swapPayload).to.equal(securePayload);
    });

    it('secureStgTokenPayload() - bytes toAddress is long version', async () => {
        const toAddress =
            ethers.constants.AddressZero +
            '98347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809983475983475983798798798273480980988889080980980998347598347598379879879827348098098888908098098099834759834759837987987982734809809888890809809809';
        const qty = 123;
        const burnAddress = '0x000000000000000000000000000000000000dEaD';

        const swapPayload = ethers.utils.defaultAbiCoder.encode(['bytes', 'uint256'], [toAddress, qty]);
        const securePayload = await validator.secureStgTokenPayload(swapPayload);

        // payload length should be modified
        expect(numOfBytes(swapPayload)).to.gt(numOfBytes(securePayload));

        // should have removed the payload and set address to 0xdead
        const expectedPayload = ethers.utils.defaultAbiCoder.encode(['bytes', 'uint256'], [burnAddress, qty]);
        expect(expectedPayload).to.equal(securePayload);
    });

    it('tryCatch() - reverts and stores properly for a contract', async () => {
        const toAddressWallet = alice.address; // wallet address
        const toAddressToken = token.address; // contract with totalSupply()
        const toAddressContract = validator.address; // contract without totalSupply()
        // const toAddressTokenDestructed = tokenDestructed.address // contract with totalSupply(), but selfDestructed

        await expect(token.tryCatch(toAddressWallet)).to.revertedWithoutReason();
        await expect(token.tryCatch(toAddressToken)).to.emit(token, 'tried');
        await expect(token.tryCatch(toAddressContract)).to.emit(token, 'caught');
    });
});
