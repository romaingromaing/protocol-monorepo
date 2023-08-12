const invariant = require('tiny-invariant');
const { ethers } = require('ethers');
const { readFileSync } = require('fs');
const path = require('path');
const { proofUtils, EVMUtilityVersion } = require('@layerzerolabs/lz-proof-utility');

function getFirstLayerZeroPacketLogIndex(_txReceipt, _srcUlnAddress) {
    for (const [index, log] of _txReceipt.logs.entries()) {
        if (
            log.topics[0] === '0xe8d23d927749ec8e512eb885679c2977d57068839d8cca1a85685dbbea0648f6' &&
            log.address === _srcUlnAddress.toLowerCase()
        ) {
            return index;
        }
    }
}

async function verifyAllLogs(
    _validator,
    _block,
    _receipts,
    _transactionIndex,
    _outboundProofType,
    _utilsVersion,
    _proofNetwork = 'default'
) {
    const proof = await proofUtils.getReceiptProof(
        _proofNetwork,
        _block,
        _receipts,
        _transactionIndex,
        _outboundProofType,
        _utilsVersion
    );
    switch (_utilsVersion) {
        case EVMUtilityVersion.V1: {
            await Promise.all(
                _receipts[_transactionIndex].logs.map(async (log, logIndex) => {
                    const verifiedLog = await _validator.getVerifyLog(
                        proof.receiptRoot,
                        proof.receiptSlotIndex,
                        logIndex,
                        proof.proof,
                        proof.pointers
                    );
                    invariant(
                        verifiedLog[0] === ethers.utils.hexZeroPad(log.address.toLowerCase(), 32),
                        'log address does not match'
                    );
                    invariant(verifiedLog[1] === log.topics[0], 'log topic0 does not match');
                    invariant(verifiedLog[2] === log.data, 'log data does not match');
                    logger.debug(`tx${_transactionIndex} utils:${_utilsVersion} log ${logIndex} proof success()`);
                })
            );
            break;
        }
        case EVMUtilityVersion.V2:
        case EVMUtilityVersion.V3: {
            await Promise.all(
                _receipts[_transactionIndex].logs.map(async (log, logIndex) => {
                    const verifiedLog = await _validator.getVerifyLog(
                        proof.receiptRoot,
                        proof.receiptSlotIndex,
                        logIndex,
                        proof.proof
                    );
                    invariant(
                        verifiedLog[0] === ethers.utils.hexZeroPad(log.address.toLowerCase(), 32),
                        'log address does not match'
                    );
                    invariant(verifiedLog[1] === log.topics[0], 'log topic0 does not match');
                    invariant(verifiedLog[2] === log.data, 'log data does not match');
                    logger.debug(`tx${_transactionIndex} utils:${_utilsVersion} log ${logIndex} proof success()`);
                })
            );
            break;
        }
        default:
            invariant(false, `Unknown utility version ${_utilsVersion}`);
    }

    logger.debug('MPT proof success()');
}

async function verifyAllLogsInTransactions(
    _validator,
    _block,
    _receipts,
    _outboundProofType,
    _utilsVersion,
    _start,
    _end,
    _proofNetwork = 'default'
) {
    await Promise.all(
        _block.transactions.map((tx) => {
            const txIndex = parseInt(tx.transactionIndex, 16);
            if (txIndex >= _start && txIndex < _end) {
                return verifyAllLogs(
                    _validator,
                    _block,
                    _receipts,
                    txIndex,
                    _outboundProofType,
                    _utilsVersion,
                    _proofNetwork
                );
            }
        })
    );
}

function readData(network, fileName) {
    const PROJECT_ROOT = path.resolve(__dirname, '..');
    const FILE_PATH = path.resolve(PROJECT_ROOT, `utils/data/proof/${network}/${fileName}.json`);
    return JSON.parse(readFileSync(FILE_PATH));
}

const logger = require('pino')({
    level: process.env.LOGLEVEL || 'info',
});

module.exports = {
    verifyAllLogs,
    verifyAllLogsInTransactions,
    readData,
    getFirstLayerZeroPacketLogIndex,
    logger,
};
