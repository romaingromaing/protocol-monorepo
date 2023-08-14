import { rlp } from 'ethereumjs-util'
import { ethers } from 'ethers'
import { matchingNibbleLength, stringToNibbles } from 'merkle-patricia-tree/util/nibbles'
import invariant from 'tiny-invariant'

import { buffer2hex, receiptProofFrom } from './common'

function findPointer(fullBytes, currentNodeElement) {
    const fullBytesHex = fullBytes.toString('hex')
    const slicedBytesHex = currentNodeElement.toString('hex')
    const result = fullBytesHex.indexOf(slicedBytesHex)
    invariant(result >= 0, 'wrong index')
    return (result - 2) / 2
}

/*
running MPT locally, strictly the same as solidity file
 */
function assertReceiptInclusion(receiptsRoot, expectedLogValue, rlpProof, pointers) {
    let nextRoot = receiptsRoot
    const proofDepth = rlpProof.length
    let pointer
    let proofBytes
    for (let i = 0; i < proofDepth; i++) {
        proofBytes = rlpProof[i]
        if (nextRoot !== ethers.utils.keccak256(proofBytes)) return false
        // load 32 bytes from the proofBytes
        if (i < pointers.length) {
            pointer = 2 + pointers[i] * 2
            nextRoot = '0x' + proofBytes.substring(pointer, pointer + 64)
        }
    }
    return true
}

function assembleMPTProof(proof, block, transactionIndex) {
    const stack = proof.stack

    // convert receipt Proof L2 nested contents into hex
    const rlpNestedProof = [...proof.receiptProof].map((node) => node.map((elem) => buffer2hex(elem)))
    const rlpProof = rlpNestedProof.map((node) => buffer2hex(rlp.encode(node)))

    // decimal of transaction index
    const receiptIndexDeci = ethers.BigNumber.from(transactionIndex).toNumber()
    const encodedMerklePath = stringToNibbles(rlp.encode(receiptIndexDeci)) // if index = 252, encoded = 81fc

    // prepare the data for offline traversal
    let hashRoot = block.receiptsRoot
    const proofDepth = stack.length
    // const targetReceipt = stack[proofDepth - 1].value;
    const targetReceipt = rlpNestedProof[rlpNestedProof.length - 1][1]
    let proofPathCounter = 0
    const totalPathLength = encodedMerklePath.length
    const pointers: number[] = []
    let receiptSlotIndex
    for (let i = 0; i < proofDepth; i++) {
        // assert the path depth constaints
        invariant(
            proofPathCounter <= totalPathLength,
            `proofPathCounter wrong at ${proofPathCounter}, where totalPathLength = ${totalPathLength}`
        )

        // thisNodeValue in array form, easier to retrieve data
        const thisNode = stack[i]
        const thisNodeValue = thisNode.raw
        // convert the elem first then hex again, it is == rlpNestedProof[i]
        const thisNodeRlp = rlpProof[i]
        invariant(
            ethers.utils.keccak256(thisNodeRlp) === hashRoot,
            `invalid hashlink at depth ${i} | proofPathCounter ${proofPathCounter} | totalPathLength = ${totalPathLength}`
        )

        if (thisNode.type === 'branch') {
            // branch node
            if (proofPathCounter === totalPathLength) {
                // has reach the end, assert targetReceipt ==
                invariant(ethers.utils.keccak256(thisNodeValue[16]) === targetReceipt, 'invalid branch value node')
                receiptSlotIndex = 16
            } else {
                // a normal branch node, step down
                const nextNibble = encodedMerklePath[proofPathCounter]
                invariant(
                    nextNibble <= 16,
                    `invalid nibble at ${nextNibble} | proofPathCounter ${proofPathCounter} | totalPathLength = ${totalPathLength}`
                )
                // hashRoot = buffer2hex(thisNode._branches[nextNibble])
                hashRoot = buffer2hex(thisNodeValue[nextNibble])
                proofPathCounter += 1
                // retrieve the pointer for the branch value
                pointers.push(findPointer(thisNodeRlp, thisNodeValue[nextNibble]))
            }
        } else if (thisNode.type === 'leaf' || thisNode.type === 'extention') {
            const progressKey = encodedMerklePath.slice(0, proofPathCounter)
            const keyRemainder = encodedMerklePath.slice(matchingNibbleLength(progressKey, encodedMerklePath))
            proofPathCounter += matchingNibbleLength(keyRemainder, stack[i].key)
            if (thisNode.type === 'leaf') {
                invariant(proofPathCounter === totalPathLength, 'invalid leaf node')
                invariant(
                    ethers.utils.keccak256(thisNodeValue[1]) === ethers.utils.keccak256(targetReceipt),
                    'wrong leaf value'
                )
                receiptSlotIndex = 1
            } else if (thisNode.type === 'extention') {
                hashRoot = buffer2hex(thisNodeValue[1])
                // retrieve the pointer for the leaf node
                pointers.push(findPointer(thisNodeRlp, thisNodeValue[1]))
            }
        } else {
            throw `unsupported node type in MPT ${thisNode} ${encodedMerklePath}`
        }
    }

    invariant(assertReceiptInclusion(block.receiptsRoot, targetReceipt, rlpProof, pointers), 'MPTLite local fails')

    return {
        receiptRoot: block.receiptsRoot,
        proof: rlpProof,
        pointers: pointers,
        receiptSlotIndex: receiptSlotIndex,
    }
}

export async function getReceiptProof(network, block, transactionReceipts, transactionIndex) {
    const proof = await receiptProofFrom(network, block, transactionReceipts, transactionIndex)
    return assembleMPTProof(proof, block, transactionIndex)
}
