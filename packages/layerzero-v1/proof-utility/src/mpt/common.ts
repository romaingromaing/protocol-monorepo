// getStateSyncTxHash returns block's tx hash for state-sync receipt
// Bor blockchain includes extra receipt/tx for state-sync logs,
// but it is not included in transactionRoot or receiptRoot.
// So, while calculating proof, we have to exclude them.
//
// This is derived from block's hash and number
// state-sync tx hash = keccak256("matic-bor-receipt-" + block.number + block.hash)
import { Proof, Receipt } from 'eth-object'
import { encode, toBuffer } from 'eth-util-lite'
import * as ethUtils from 'ethereumjs-util'
import { promisfy } from 'promisfy'
import { Buffer } from 'safer-buffer'
import invariant from 'tiny-invariant'

const Tree = require('merkle-patricia-tree')

export function getPolygonStateSyncTxHash(block) {
    return ethUtils.bufferToHex(
        ethUtils.keccak256(
            Buffer.concat([
                ethUtils.toBuffer('matic-bor-receipt-'), // prefix for bor receipt
                ethUtils.setLengthLeft(ethUtils.toBuffer(block.number), 8), // 8 bytes of block number (BigEndian)
                ethUtils.toBuffer(block.hash), // block hash
            ])
        )
    )
}

export function buffer2hex(buffer) {
    return '0x' + buffer.toString('hex')
}

export async function receiptProofFrom(network, block, transactionReceipts, transactionIndex) {
    // handle the polygon special receipt
    if (network === 'polygon') {
        const ignoredTxnHash = getPolygonStateSyncTxHash(block)
        transactionReceipts = transactionReceipts.filter((receipt) => receipt.transactionHash !== ignoredTxnHash)
    }

    const tree = new Tree()
    await Promise.all(
        transactionReceipts.map((siblingReceipt, index) => {
            const siblingPath = encode(index)

            if (network === 'harmony' && index >= block.transactions.length) {
                // void staking receipt type, which works differently from EIP2718
                siblingReceipt.type = 0
            }

            let serializedReceipt = Receipt.fromRpc(siblingReceipt)

            //handles the arbitrum receipt
            if (network === 'arbitrum') {
                //todo: will not need this in aribtrum nitro
                serializedReceipt[0] = toBuffer(0)
            }
            serializedReceipt = serializedReceipt.serialize()

            // if type is defined, concat type and RLP buffer seperately (for receipts/transactions following EIP2718)
            if (siblingReceipt.type) {
                serializedReceipt = Buffer.concat([toBuffer(siblingReceipt.type), serializedReceipt])
            }

            return promisfy(tree.put, tree)(siblingPath, serializedReceipt)
        })
    )

    const [_, __, stack] = await promisfy(tree.findPath, tree)(encode(transactionIndex))

    // assert the tree root
    const receiptRootFromBlock = block.receiptsRoot.slice(2)
    invariant(
        receiptRootFromBlock === tree._root.toString('hex'),
        'receiptRoot from rpc block != receipt root we built'
    )

    return {
        stack: stack,
        receiptProof: Proof.fromStack(stack),
    }
}
