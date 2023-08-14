import { rlp } from 'ethereumjs-util'
import { ethers } from 'ethers'
import { matchingNibbleLength, stringToNibbles } from 'merkle-patricia-tree/util/nibbles'
import invariant from 'tiny-invariant'

import { buffer2hex, receiptProofFrom } from './common'

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
    const path: number[] = []
    for (let i = 0; i < proofDepth; i++) {
        // console.log(`hashroot at ${i} : ${hashRoot}`)
        // console.log(`    rlpProof at ${rlpProof[i]}`)

        // assert the path depth constraints
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
                path[i] = 16
                console.warn(`a branch node 16 value type ${transactionIndex} receipt root ${block.receiptsRoot}`)
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
                path[i] = nextNibble
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
                path[i] = 1
            } else if (thisNode.type === 'extention') {
                path[i] = 1
                hashRoot = buffer2hex(thisNodeValue[1])
                // retrieve the pointer for the leaf node
            }
        } else {
            throw `unsupported node type in MPT ${thisNode} ${encodedMerklePath}`
        }
    }

    invariant(assertReceiptInclusion(block.receiptsRoot, targetReceipt, rlpProof, path, stack), 'MPTLite local fails')

    return {
        receiptRoot: block.receiptsRoot,
        proof: rlpProof,
        receiptSlotIndex: path,
    }
}

/*
running MPT locally, strictly the same as solidity file
 */
function assertReceiptInclusion(receiptsRoot, expectedLogValue, rlpProof, path, stack) {
    let nextRoot = receiptsRoot
    const proofDepth = rlpProof.length
    for (let i = 0; i < proofDepth; i++) {
        const proofBytes = rlpProof[i]
        const thisNodeValue = stack[i].raw
        if (nextRoot !== ethers.utils.keccak256(proofBytes)) return false
        if (i < proofDepth - 1) {
            nextRoot = buffer2hex(thisNodeValue[path[i]])
        }
    }
    return true
}

export async function getReceiptProof(network, block, transactionReceipts, transactionIndex) {
    const proof = await receiptProofFrom(network, block, transactionReceipts, transactionIndex)
    return assembleMPTProof(proof, block, transactionIndex)
}
