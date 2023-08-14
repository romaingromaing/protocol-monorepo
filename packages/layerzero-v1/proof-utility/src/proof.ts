import { ethers } from 'ethers'
import invariant from 'tiny-invariant'

import { EVMUtilityVersion, NETWORKS, OutboundProofType } from './constants'
import { getReceiptProof as getReceiptProofV1 } from './mpt/v1'
import { getReceiptProof as getReceiptProofV2 } from './mpt/v2'

export function getFeatherProof(utilsVersion, emitterAddress, packetPayload) {
    switch (utilsVersion) {
        case EVMUtilityVersion.V1: {
            const contractAddrByte32 = ethers.utils.hexZeroPad(emitterAddress, 32)
            return {
                proof: ethers.utils.solidityPack(['bytes32', 'bytes'], [contractAddrByte32, packetPayload]),
            }
        }
        case EVMUtilityVersion.V2: {
            return {
                proof: packetPayload,
            }
        }
        default:
            throw new Error(`Unknown utility version ${utilsVersion}`)
    }
}

export async function getReceiptProof(
    network,
    block,
    transactionReceipts,
    transactionIndex,
    outboundProofType,
    utilsVersion
) {
    invariant(NETWORKS.includes(network), `Unsupported network: ${network}`)

    switch (outboundProofType) {
        case OutboundProofType.MPT: {
            switch (utilsVersion) {
                case EVMUtilityVersion.V1: {
                    return await getReceiptProofV1(network, block, transactionReceipts, transactionIndex)
                }
                case EVMUtilityVersion.V2:
                case EVMUtilityVersion.V4: {
                    return await getReceiptProofV2(network, block, transactionReceipts, transactionIndex)
                }
                case EVMUtilityVersion.V3: {
                    const proof = await getReceiptProofV2(network, block, transactionReceipts, transactionIndex)
                    proof['blockHash'] = block.hash
                    return proof
                }
                default:
                    throw new Error(`Unsupported utility version ${utilsVersion}`)
            }
        }
        default:
            throw new Error(`Unsupported Outbound Proof Type ${outboundProofType}`)
    }
}

export function encodeParams(proof, outboundProofType, utilsVersion, logIndex, srcEndpointId = undefined) {
    switch (outboundProofType) {
        case OutboundProofType.MPT: {
            switch (utilsVersion) {
                case EVMUtilityVersion.V1: {
                    return ethers.utils.defaultAbiCoder.encode(
                        ['uint16', 'bytes[]', 'uint256[]', 'uint256', 'uint256'],
                        [srcEndpointId, proof.proof, proof.pointers, proof.receiptSlotIndex, logIndex]
                    )
                }
                case EVMUtilityVersion.V2: {
                    return ethers.utils.defaultAbiCoder.encode(
                        ['uint16', 'bytes[]', 'uint256[]', 'uint256'],
                        [srcEndpointId, proof.proof, proof.receiptSlotIndex, logIndex]
                    )
                }
                case EVMUtilityVersion.V3: {
                    return ethers.utils.defaultAbiCoder.encode(
                        ['uint16', 'bytes32', 'bytes[]', 'uint256[]', 'uint256'],
                        [srcEndpointId, proof.blockHash, proof.proof, proof.receiptSlotIndex, logIndex]
                    )
                }
                case EVMUtilityVersion.V4: {
                    return ethers.utils.defaultAbiCoder.encode(
                        ['bytes[]', 'uint256[]', 'uint256'],
                        [proof.proof, proof.receiptSlotIndex, logIndex]
                    )
                }
                default:
                    throw new Error(`Unsupported utility version ${utilsVersion}`)
            }
        }
        default:
            throw new Error(`Unsupported Outbound Proof Type ${outboundProofType}`)
    }
}

export function getLayerZeroPacket(srcChainId, _log) {
    //todo: what if src address differs from 20 bytes
    const packet = ethers.utils.defaultAbiCoder.decode(['uint16', 'bytes'], _log.data)
    const data = packet[1].slice(2)

    //todo: what if dst address differs from 20 bytes
    const dstChainId = parseInt(packet[0])
    const nonce = ethers.BigNumber.from('0x' + data.slice(0, 16)).toNumber()
    const srcAddress = '0x' + data.slice(16, 56)
    const dstAddress = '0x' + data.slice(56, 96)

    let payload = '0x'
    if (data.length > 96) {
        //has payload
        payload = '0x' + data.slice(96, data.length)
    }

    return {
        srcChainId,
        dstChainId,
        nonce,
        dstAddress,
        srcAddress,
        ulnAddress: ethers.utils.defaultAbiCoder.encode(['address'], [_log.address]),
        payload,
    }
}
