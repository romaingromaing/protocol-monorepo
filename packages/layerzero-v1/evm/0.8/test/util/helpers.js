const { expect } = require('chai');
const { proofUtils } = require('@layerzerolabs/lz-proof-utility');
const {
    getOutboundProofType,
    callAsContract,
    getValidateFunction,
    encodePackedParams,
} = require('../../../0.7/utils/helpers');
const { ethers } = require('ethers');
const { VARS } = require('../../../0.7/utils/constants');
const { DEFAULT_APP_CONFIG_VALUES } = require('./constants');
const { network } = require('hardhat');

// return the relayer's event
const pingPong = async (a, b, pings = 0, attributes = {}) => {
    const tx = await a.pingPong.ping(b.chainId, b.pingPong.address, pings);
    const gasLimit = attributes.gasLimit ?? 10000000;
    return await deliverMsg(tx, a, b, b.pingPong.address, { gasLimit });
};

// return the relayer's event
const incrementCounter = async (a, b, attributes = {}) => {
    const gasLimit = attributes.gasLimit ?? 100000;

    const tx = await a.counterMock.incrementCounter(b.chainId, '0x', attributes.payload || '0x', {
        value: attributes.value || 300000,
    });
    return await deliverMsg(tx, a, b, b.counterMock.address, { gasLimit });
};

const incrementCounterWithTestV2 = async (a, b, attributes = {}) => {
    const aInboundNonceKey = encodePackedParams(['address', 'address'], [b.counterMock.address, a.counterMock.address]);
    const bInboundNonceKey = encodePackedParams(['address', 'address'], [a.counterMock.address, b.counterMock.address]);

    // state before the msg gets sent across
    const aRemoteCounter = await a.counterMock.remoteAddressCounter(b.counterMock.address);
    const bRemoteCounter = await b.counterMock.remoteAddressCounter(a.counterMock.address);
    const aOutboundNonce = await a.ultraLightNode.getOutboundNonce(b.chainId, aInboundNonceKey);
    const bOutBoundNonce = await b.ultraLightNode.getOutboundNonce(a.chainId, bInboundNonceKey);
    const aInboundNonce = await a.lzEndpoint.getInboundNonce(b.chainId, aInboundNonceKey);
    const bInboundNonce = await b.lzEndpoint.getInboundNonce(a.chainId, bInboundNonceKey);

    await incrementCounter(a, b, attributes);

    // state afterwards
    expect(await a.counterMock.remoteAddressCounter(b.counterMock.address)).to.equal(aRemoteCounter);
    expect(await b.counterMock.remoteAddressCounter(a.counterMock.address)).to.equal(bRemoteCounter.add(1));
    expect(await a.ultraLightNode.getOutboundNonce(b.chainId, aInboundNonceKey)).to.equal(aOutboundNonce.add(1));
    expect(await b.ultraLightNode.getOutboundNonce(a.chainId, bInboundNonceKey)).to.equal(bOutBoundNonce);
    expect(await a.lzEndpoint.getInboundNonce(b.chainId, aInboundNonceKey)).to.equal(aInboundNonce);
    expect(await b.lzEndpoint.getInboundNonce(a.chainId, bInboundNonceKey)).to.equal(bInboundNonce.add(1));
};

const incrementCounterWithTestSameChainV2 = async (a, attributes = {}) => {
    const b = a;
    const aInboundNonceKey = encodePackedParams(['address', 'address'], [b.counterMock.address, a.counterMock.address]);
    const bInboundNonceKey = encodePackedParams(['address', 'address'], [a.counterMock.address, b.counterMock.address]);

    // state before the msg gets sent across
    const aRemoteCounter = await a.counterMock.remoteAddressCounter(b.counterMock.address);
    const bRemoteCounter = await b.counterMock.remoteAddressCounter(a.counterMock.address);
    const aOutboundNonce = await a.ultraLightNode.getOutboundNonce(b.chainId, aInboundNonceKey);
    const bOutBoundNonce = await b.ultraLightNode.getOutboundNonce(a.chainId, bInboundNonceKey);
    const aInboundNonce = await a.lzEndpoint.getInboundNonce(b.chainId, aInboundNonceKey);
    const bInboundNonce = await b.lzEndpoint.getInboundNonce(a.chainId, bInboundNonceKey);

    await incrementCounter(a, b, attributes);

    // src counter and dst counter are the same thing, so everything should increment by 1
    // state afterwards
    expect(await a.counterMock.remoteAddressCounter(b.counterMock.address)).to.equal(aRemoteCounter.add(1));
    expect(await b.counterMock.remoteAddressCounter(a.counterMock.address)).to.equal(bRemoteCounter.add(1));
    expect(await a.ultraLightNode.getOutboundNonce(b.chainId, aInboundNonceKey)).to.equal(aOutboundNonce.add(1));
    expect(await b.ultraLightNode.getOutboundNonce(a.chainId, bInboundNonceKey)).to.equal(bOutBoundNonce.add(1));
    expect(await a.lzEndpoint.getInboundNonce(b.chainId, aInboundNonceKey)).to.equal(aInboundNonce.add(1));
    expect(await b.lzEndpoint.getInboundNonce(a.chainId, bInboundNonceKey)).to.equal(bInboundNonce.add(1));
};

const incrementCounterWithTest = async (a, b, attributes = {}) => {
    // state before the msg gets sent across
    const aRemoteCounter = await a.counterMock.remoteAddressCounter(b.counterMock.address);
    const bRemoteCounter = await b.counterMock.remoteAddressCounter(a.counterMock.address);
    const aOutboundNonce = await a.lzEndpoint.getOutboundNonce(b.chainId, a.counterMock.address);
    const bOutBoundNonce = await b.lzEndpoint.getOutboundNonce(a.chainId, b.counterMock.address);
    const aInboundNonce = await a.lzEndpoint.getInboundNonce(b.chainId, b.counterMock.address);
    const bInboundNonce = await b.lzEndpoint.getInboundNonce(a.chainId, a.counterMock.address);

    await incrementCounter(a, b, attributes);

    // state afterwards
    expect(await a.counterMock.remoteAddressCounter(b.counterMock.address)).to.equal(aRemoteCounter);
    expect(await b.counterMock.remoteAddressCounter(a.counterMock.address)).to.equal(bRemoteCounter.add(1));
    expect(await a.lzEndpoint.getOutboundNonce(b.chainId, a.counterMock.address)).to.equal(aOutboundNonce.add(1));
    expect(await b.lzEndpoint.getOutboundNonce(a.chainId, b.counterMock.address)).to.equal(bOutBoundNonce);
    expect(await a.lzEndpoint.getInboundNonce(b.chainId, b.counterMock.address)).to.equal(aInboundNonce);
    expect(await b.lzEndpoint.getInboundNonce(a.chainId, a.counterMock.address)).to.equal(bInboundNonce.add(1));
};

const incrementCounterWithTestSameChain = async (a, attributes = {}) => {
    const b = a;
    // state before the msg gets sent across
    const aRemoteCounter = await a.counterMock.remoteAddressCounter(b.counterMock.address);
    const bRemoteCounter = await b.counterMock.remoteAddressCounter(a.counterMock.address);
    const aOutboundNonce = await a.lzEndpoint.getOutboundNonce(b.chainId, a.counterMock.address);
    const bOutBoundNonce = await b.lzEndpoint.getOutboundNonce(a.chainId, b.counterMock.address);
    const aInboundNonce = await a.lzEndpoint.getInboundNonce(b.chainId, b.counterMock.address);
    const bInboundNonce = await b.lzEndpoint.getInboundNonce(a.chainId, a.counterMock.address);

    await incrementCounter(a, b, attributes);

    // src counter and dst counter are the same thing, so everything should increment by 1
    // state afterwards
    expect(await a.counterMock.remoteAddressCounter(b.counterMock.address)).to.equal(aRemoteCounter.add(1));
    expect(await b.counterMock.remoteAddressCounter(a.counterMock.address)).to.equal(bRemoteCounter.add(1));
    expect(await a.lzEndpoint.getOutboundNonce(b.chainId, a.counterMock.address)).to.equal(aOutboundNonce.add(1));
    expect(await b.lzEndpoint.getOutboundNonce(a.chainId, b.counterMock.address)).to.equal(bOutBoundNonce.add(1));
    expect(await a.lzEndpoint.getInboundNonce(b.chainId, b.counterMock.address)).to.equal(aInboundNonce.add(1));
    expect(await b.lzEndpoint.getInboundNonce(a.chainId, a.counterMock.address)).to.equal(bInboundNonce.add(1));
};

deliverMsg = async (tx, src, dst, targetDestAddress, attributes = {}) => {
    const confirmations = attributes.confirmations ?? 15;
    const gasLimit = attributes.gasLimit ?? 100000;
    const value = attributes.value ?? 0;
    const outboundProofType = await getOutboundProofType(src.ultraLightNode, src.counterMock, dst.chainId);

    await deliverOracle(tx, src.chainId, dst.ultraLightNode, dst.oracle, confirmations);
    return await deliverRelayer(
        tx,
        src.chainId,
        dst.ultraLightNode,
        targetDestAddress,
        dst.relayer,
        outboundProofType,
        gasLimit,
        value
    );
};

// Used for retrying a failed deliverMsg call
redeliverMsg = async (tx, src, dst, targetDestAddress, attributes = {}) => {
    const gasLimit = attributes.gasLimit ?? 100000;
    const outboundProofType = await getOutboundProofType(src.ultraLightNode, src.counterMock, dst.chainId);

    return await deliverRelayer(
        tx,
        src.chainId,
        dst.ultraLightNode,
        targetDestAddress,
        dst.relayer,
        outboundProofType,
        gasLimit
    );
};

deliverOracle = async (tx, srcChainId, ultraLightNode, oracle, confirmations) => {
    const receipt = await network.provider.send('eth_getTransactionReceipt', [tx.hash]);
    const logIndex = receipt.logs.findIndex((x) => {
        return x.topics[0].toString() === '0xe9bded5f24a4168e4f3bf44e00298c993b22376aad8c58c7dda9718a54cbea82';
    });
    const emitterContract = receipt.logs[logIndex].address;
    const lzPacket = ethers.utils.defaultAbiCoder.decode(['bytes'], receipt.logs[logIndex].data)[0];
    const rawProof = proofUtils.getFeatherProof(1, emitterContract, lzPacket);

    const oracleOwner = await oracle.owner();
    await callAsContract(oracle, oracleOwner, 'updateHash(uint16,bytes32,uint256,bytes32)', [
        srcChainId,
        ethers.utils.keccak256(rawProof.proof),
        confirmations,
        ethers.utils.keccak256(rawProof.proof),
    ]);
};

deliverRelayer = async (
    tx,
    srcEndpointId,
    ultraLightNode,
    targetDstAddress,
    relayer,
    outboundProofType,
    gasLimit,
    extraNative = 0
) => {
    const receipt = await network.provider.send('eth_getTransactionReceipt', [tx.hash]);
    const logIndex = receipt.logs.findIndex((x) => {
        return x.topics[0].toString() === '0xe9bded5f24a4168e4f3bf44e00298c993b22376aad8c58c7dda9718a54cbea82';
    });
    const emitterContract = receipt.logs[logIndex].address;
    const lzPacket = ethers.utils.defaultAbiCoder.decode(['bytes'], receipt.logs[logIndex].data)[0];
    const rawProof = proofUtils.getFeatherProof(1, emitterContract, lzPacket);

    // relayer validate function
    const validateFunction = getValidateFunction(relayer, extraNative);

    // params
    const hash = ethers.utils.keccak256(rawProof.proof);
    let params =
        extraNative > 0
            ? [srcEndpointId, targetDstAddress, gasLimit, hash, hash, rawProof.proof, targetDstAddress]
            : [srcEndpointId, targetDstAddress, gasLimit, hash, hash, rawProof.proof];

    // assume the to_ is always relayer signer as a hack
    return await callAsContract(relayer, relayer.address, validateFunction, params, extraNative);
};

wireEndpoint = async (src, dst, uln = true, v2 = false) => {
    const {
        baseGas,
        gasPerByte,
        dstNativeCap,
        outboundProofType,
        outboundProofType2,
        dstGasPrice,
        adapterParams,
        chainAddressSize,
    } = VARS;

    await src.ultraLightNode.addInboundProofLibraryForChain(dst.chainId, src.evmValidator.address);
    await src.ultraLightNode.enableSupportedOutboundProof(dst.chainId, outboundProofType);
    await src.ultraLightNode.enableSupportedOutboundProof(dst.chainId, outboundProofType2);
    // if a chain address is specified in the endpoint, then override the default
    await src.ultraLightNode.setChainAddressSize(dst.chainId, dst.chainAddressSize || chainAddressSize);
    await src.ultraLightNode.setDefaultAdapterParamsForChainId(
        dst.chainId,
        outboundProofType,
        ethers.utils.solidityPack(adapterParams[outboundProofType].types, adapterParams[outboundProofType].values)
    );
    await src.ultraLightNode.setDefaultAdapterParamsForChainId(
        dst.chainId,
        outboundProofType2,
        ethers.utils.solidityPack(adapterParams[outboundProofType2].types, adapterParams[outboundProofType2].values)
    );
    await src.ultraLightNode.setDefaultConfigForChainId(
        dst.chainId,
        DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
        DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
        src.relayer.address,
        src.outboundProofType,
        DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
        src.oracle.address
    );

    // await src.oracle.setJob(dst.chainId, src.oracle.address, oracleJobId, oracleFee)
    await src.oracle.setDeliveryAddress(dst.chainId, dst.oracle.address);

    await src.relayer.setDstPrice(dst.chainId, 10000, dstGasPrice);
    await src.relayer.setDstConfig(dst.chainId, outboundProofType, dstNativeCap, baseGas, gasPerByte);
    await src.relayer.setDstConfig(dst.chainId, outboundProofType2, dstNativeCap, baseGas, gasPerByte);

    // allow the setup to refrain from setting remote uln
    if (uln) {
        const dstUlnAddressBytes32 = ethers.utils.hexZeroPad(dst.ultraLightNode.address, 32);
        await src.ultraLightNode.setRemoteUln(dst.chainId, dstUlnAddressBytes32);
    }

    const trustedRemote = v2
        ? encodePackedParams(['address', 'address'], [dst.counterMock.address, src.counterMock.address])
        : encodePackedParams(['address'], [dst.counterMock.address]);
    // set counter trusted remote
    await src.counterMock.setTrustedRemote(dst.chainId, trustedRemote);
};

wireEndpoints = async (endpoints, uln = true, v2 = false) => {
    for (let a = 0; a < endpoints.length; a++) {
        for (let b = 0; b < endpoints.length; b++) {
            await wireEndpoint(endpoints[a], endpoints[b], uln, v2);
        }
    }
    return endpoints;
};

module.exports = {
    deliverMsg,
    deliverRelayer,
    deliverOracle,
    redeliverMsg,
    incrementCounter,
    pingPong,
    incrementCounterWithTest,
    incrementCounterWithTestSameChain,
    incrementCounterWithTestV2,
    incrementCounterWithTestSameChainV2,
    wireEndpoints,
};
