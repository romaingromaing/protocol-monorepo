const { ethers } = require('hardhat');
const { expect } = require('chai');
const { verifyAllLogsInTransactions, logger } = require('../../utils/proof');
const { OutboundProofType, EVMUtilityVersion } = require('@layerzerolabs/lz-proof-utility');

describe('Stress Proof', () => {
    let mpt;
    let signers;
    let owner;
    let alice;
    let token;

    before(async () => {
        signers = await ethers.getSigners();
        owner = signers[0];
        alice = signers[1];

        const Token = await ethers.getContractFactory('Token');
        token = await Token.deploy();
        await token.deployed();

        const MPTValidator = await ethers.getContractFactory('MPTValidatorV2');
        mpt = await MPTValidator.deploy();
        await mpt.deployed();
    });

    it('Stressed', async () => {
        const txNumber = 20; //todo: hardhat unable to pack more than 28 txs into one block

        await ethers.provider.send('evm_setAutomine', [false]);
        const txPromises = [];
        for (let i = 0; i < txNumber; i++) {
            logger.debug(`Packing ${i}`);
            txPromises.push(token.transfer(alice.address, 1));
        }
        const txs = await Promise.all(txPromises);

        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_setAutomine', [true]);

        const latestBlock = await ethers.provider.getBlock('latest');
        expect(latestBlock.transactions.length).to.equal(txNumber);
        const receipts = latestBlock.transactions.map(async (tx) => {
            await ethers.provider.getTransactionReceipt(tx);
        });

        await verifyAllLogsInTransactions(
            mpt,
            latestBlock,
            receipts,
            OutboundProofType.MPT,
            EVMUtilityVersion.V2,
            0,
            txNumber
        );
    });
});
