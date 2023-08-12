const { network } = require('hardhat');
const { proofUtils } = require('@layerzerolabs/lz-proof-utility');
const {
    getOutboundProofType,
    callAsContract,
    getBlock,
    getValidateFunction,
    encodePackedParams,
} = require('../../utils/helpers');
const { expect } = require('chai');
const { VARS } = require('../../utils/constants');
const { DEFAULT_APP_CONFIG_VALUES } = require('./constants');

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
    const block = await getBlock(tx);

    const oracleOwner = await oracle.owner();
    await callAsContract(oracle, oracleOwner, 'updateHash(uint16,bytes32,uint256,bytes32)', [
        srcChainId,
        tx.blockHash,
        confirmations,
        block.receiptsRoot,
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
    const block = await getBlock(tx);
    const receipt = await network.provider.send('eth_getTransactionReceipt', [tx.hash]);

    // events
    let ulnVersion, proofUtilsVersion;
    const logIndex = receipt.logs.findIndex((x) => {
        // we have found a relayer packet emitted, ie. this is the correct event
        switch (x.topics[0].toString()) {
            case '0xe8d23d927749ec8e512eb885679c2977d57068839d8cca1a85685dbbea0648f6':
                ulnVersion = 1;
                proofUtilsVersion = 2;
                return true;
            case '0xe9bded5f24a4168e4f3bf44e00298c993b22376aad8c58c7dda9718a54cbea82':
                ulnVersion = 2;
                proofUtilsVersion = 4;
                return true;
            default:
                return false;
        }
    });
    if (logIndex === -1) throw 'no log in receipt, check the packet signature hash';

    const receipts = await Promise.all(
        block.transactions.map(async (tx) => network.provider.send('eth_getTransactionReceipt', [tx.hash]))
    );
    const rawProof = await proofUtils.getReceiptProof(
        'default',
        block,
        receipts,
        receipt.transactionIndex,
        outboundProofType,
        proofUtilsVersion
    );
    const proof = proofUtils.encodeParams(rawProof, outboundProofType, proofUtilsVersion, logIndex, srcEndpointId);

    // relayer validate function
    const validateFunction = getValidateFunction(relayer, extraNative);

    // params
    let params;
    switch (ulnVersion) {
        case 1:
            params =
                extraNative > 0
                    ? [srcEndpointId, targetDstAddress, gasLimit, tx.blockHash, proof, targetDstAddress]
                    : [srcEndpointId, targetDstAddress, gasLimit, tx.blockHash, proof];
            break;
        case 2:
            const receiptsRoot = (await hre.ethers.provider.send('eth_getBlockByHash', [tx.blockHash, true]))
                .receiptsRoot;
            params =
                extraNative > 0
                    ? [srcEndpointId, targetDstAddress, gasLimit, tx.blockHash, receiptsRoot, proof, targetDstAddress]
                    : [srcEndpointId, targetDstAddress, gasLimit, tx.blockHash, receiptsRoot, proof];
            break;
        default:
            throw 'invalid ulnVersion passed';
    }

    // assume the to_ is always relayer signer as a hack
    return await callAsContract(relayer, relayer.address, validateFunction, params, extraNative);
};

wireEndpoint = async (src, dst, uln = true, v2 = false) => {
    const { baseGas, gasPerByte, dstNativeCap, outboundProofType, dstGasPrice, adapterParams, chainAddressSize } = VARS;

    await src.ultraLightNode.addInboundProofLibraryForChain(dst.chainId, src.evmValidator.address);
    await src.ultraLightNode.enableSupportedOutboundProof(dst.chainId, outboundProofType);
    await src.ultraLightNode.enableSupportedOutboundProof(dst.chainId, outboundProofType);
    // if a chain address is specified in the endpoint, then override the default
    await src.ultraLightNode.setChainAddressSize(dst.chainId, dst.chainAddressSize || chainAddressSize);
    await src.ultraLightNode.setDefaultAdapterParamsForChainId(
        dst.chainId,
        outboundProofType,
        ethers.utils.solidityPack(adapterParams[outboundProofType].types, adapterParams[outboundProofType].values)
    );
    await src.ultraLightNode.setDefaultAdapterParamsForChainId(
        dst.chainId,
        outboundProofType,
        ethers.utils.solidityPack(adapterParams[outboundProofType].types, adapterParams[outboundProofType].values)
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
    await src.relayer.setDstConfig(dst.chainId, outboundProofType, dstNativeCap, baseGas, gasPerByte);

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
    redeliverMsg,
    deliverRelayer,
    deliverOracle,
    incrementCounter,
    pingPong,
    incrementCounterWithTest,
    incrementCounterWithTestSameChain,
    incrementCounterWithTestV2,
    incrementCounterWithTestSameChainV2,
    wireEndpoints,
};
