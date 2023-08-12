const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers, network, web3 } = require('hardhat');

const {
    ID_TO_CHAIN_NAME,
    VARS,
    CONFIG_TYPE_RELAYER,
    CONFIG_TYPE_ORACLE,
    CONFIG_TYPE_OUTBOUND_PROOF_TYPE,
    CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS,
    CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS,
    CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION,
} = require('./constants');

getAddr = async (ethers) => {
    const signers = await ethers.getSigners();
    const [deployer, proxyOwner, user1, user2, user3, user4, badUser1, badUser2, fakeContract] = [
        signers[0],
        signers[11],
        signers[12],
        signers[13],
        signers[14],
        signers[15],
        signers[16],
        signers[17],
        signers[18],
    ];

    const layerzeroDeployer = await ethers.getNamedSigner('layerzero');
    const relayerDeployer = await ethers.getNamedSigner('relayer');
    const proxyAdminDeployer = await ethers.getNamedSigner('proxyAdmin');

    return {
        deployer,
        proxyOwner,
        user1,
        user2,
        user3,
        user4,
        badUser1,
        badUser2,
        fakeContract,
        layerzeroDeployer,
        relayerDeployer,
        proxyAdminDeployer,
    };
};

checkBalance = async (address, expected) => {
    let balance = await hre.ethers.provider.getBalance(address);
    expect(balance).to.equal(BigNumber.from(expected));
    return balance;
};

checkTokenBalance = async (token, address, expected) => {
    const balance = await token.balanceOf(address);
    expect(balance).to.equal(BigNumber.from(expected));
    return balance;
};

getBalance = async (address) => {
    return await hre.ethers.provider.getBalance(address);
};

// !!! User at own risk, txEther might need to be increased if running out of gas
callAsContract = async (contract, impersonateAddr, funcNameAsStr, params = [], msgValue = 0) => {
    const existingBal = await hre.ethers.provider.getBalance(impersonateAddr);

    // Might need to increase this for big transactions
    const txEther = BigNumber.from('10000000000000000000000000');
    const msgValueBn = BigNumber.from(msgValue);

    // Update the balance on the network
    await network.provider.send('hardhat_setBalance', [
        impersonateAddr,
        existingBal.add(txEther).add(msgValueBn).toHexString().replace('0x0', '0x'),
    ]);

    // Retrieve the signer for the person to impersonate
    const signer = await ethers.getSigner(impersonateAddr);

    // Impersonate the smart contract to make the corresponding call on their behalf
    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [impersonateAddr],
    });

    // Process the transaction on their behalf
    const rec = await contract.connect(signer)[funcNameAsStr](...params, { value: msgValueBn });
    const tx = await rec.wait();

    // The amount of gas consumed by the transaction
    const etherUsedForGas = tx.gasUsed.mul(tx.effectiveGasPrice);
    const extraEther = txEther.sub(etherUsedForGas);

    // Balance post transaction
    const currentBal = await hre.ethers.provider.getBalance(impersonateAddr);

    // Subtract the difference  in the amount of ether given
    // vs the amount used in the transaction
    await hre.network.provider.send('hardhat_setBalance', [
        impersonateAddr,
        currentBal.sub(extraEther).toHexString().replace('0x0', '0x'),
    ]);

    // Undo the impersonate so we go back to the default
    await hre.network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [impersonateAddr],
    });

    return rec;
};

getBlock = async (tx) => {
    return await network.provider.send('eth_getBlockByHash', [tx.blockHash, true]);
};

const checkOutboundNonce = async (a, b, value) => {
    expect(await a.lzEndpoint.getOutboundNonce(b.chainId, a.counterMock.address)).to.equal(value);
};
const checkInboundNonce = async (a, b, value) => {
    expect(await a.lzEndpoint.getInboundNonce(b.chainId, b.counterMock.address)).to.equal(value);
};
const checkOutboundNonceV2 = async (a, b, value) => {
    const path = encodePackedParams(['address', 'address'], [b.counterMock.address, a.counterMock.address]);
    expect(await a.ultraLightNode.getOutboundNonce(b.chainId, path)).to.equal(value);
};
const checkInboundNonceV2 = async (a, b, value) => {
    const inboundNonceKey = encodePackedParams(['address', 'address'], [b.counterMock.address, a.counterMock.address]);
    expect(await a.lzEndpoint.getInboundNonce(b.chainId, inboundNonceKey)).to.equal(value);
};
const checkCounter = async (a, b, v) => {
    expect(await a.counterMock.remoteAddressCounter(b.counterMock.address)).to.equal(v);
};
const checkCounters = async (src, dst, srcValue, dstValue) => {
    await checkCounter(src, dst, srcValue);
    await checkCounter(dst, src, dstValue);
};

getValidateFunction = (relayer, extraNative) => {
    // handles various function signatures and looks specifically for the func name, not the params
    const validateFunction = extraNative > 0 ? 'validateTransactionProofV2' : 'validateTransactionProofV1';
    for (const [key, value] of Object.entries(relayer.functions)) {
        if (key.includes(validateFunction)) return key;
    }
    throw 'missing validate function in the relayer contract';
};

deployNew = async (contractName, params = []) => {
    const C = await ethers.getContractFactory(contractName);
    return await C.deploy(...params);
};

generateEndpoints = async (endpointIds) => {
    return await Promise.all(
        endpointIds.map(async (chainId) => {
            return {
                chainId,
                lzEndpoint: await deployNew('Endpoint', [chainId]),
                lzToken: await deployNew('LayerZeroTokenMock'),
            };
        })
    );
};

getBaseContracts = async (lzEndpoint, chainId, deployPingPong, ulnV2, fp) => {
    let ultraLightNode, oracle, relayer, treasury, counterMock, evmValidator, pingPong, nonceContract;

    nonceContract = await deployNew('NonceContract', [lzEndpoint.address]);
    ultraLightNode = ulnV2
        ? await deployNew('UltraLightNodeV2', [lzEndpoint.address, nonceContract.address, chainId])
        : await deployNew('UltraLightNode', [lzEndpoint.address]);
    oracle = ulnV2 ? await deployNew('LayerZeroOracleMockV2') : await deployNew('LayerZeroOracleMock');
    treasury = ulnV2
        ? await deployNew('TreasuryV2', [ultraLightNode.address])
        : await deployNew('Treasury', [ultraLightNode.address]);
    counterMock = await deployNew('OmniCounter', [lzEndpoint.address]);

    let priceFeed;
    if (ulnV2) {
        priceFeed = await deployNew('PriceFeedV2Mock', []);
        await priceFeed.initialize(await priceFeed.owner());
    }

    if (deployPingPong) pingPong = await deployNew('PingPong', [lzEndpoint.address, ulnV2]);

    relayer = ulnV2 ? await deployNew('RelayerV2') : await deployNew('Relayer');
    if (ulnV2) {
        await relayer.initialize(ultraLightNode.address, priceFeed.address); // hardhat deploy scripts initialize this for us
    } else {
        await relayer.initialize(ultraLightNode.address);
    }

    if (fp) {
        evmValidator = await deployNew('FPValidator', [ethers.constants.AddressZero, ethers.constants.AddressZero]);
    } else {
        evmValidator = ulnV2
            ? // ? await deployNew("MPTValidator01", [ethers.constants.AddressZero, ethers.constants.AddressZero])
              await deployNew('MPTValidator01', [ethers.constants.AddressZero, ethers.constants.AddressZero])
            : await deployNew('MPTValidatorV2');
    }

    return {
        ultraLightNode,
        oracle,
        relayer,
        treasury,
        counterMock,
        pingPong,
        evmValidator,
        nonceContract,
        priceFeed,
    };
};

generateVersion = async (
    endpoint,
    chainIds,
    inboundProofType,
    version = 1,
    deployPingPong = false,
    ulnV2 = false,
    fp = false
) => {
    const { lzEndpoint, lzToken } = endpoint;
    const { oracleFee, outboundProofType, outboundProofType2, nativeBP } = VARS;
    const { ultraLightNode, oracle, relayer, treasury, counterMock, evmValidator, pingPong, nonceContract } =
        await getBaseContracts(lzEndpoint, endpoint.chainId, deployPingPong, ulnV2, fp);

    // treasury
    await treasury.setNativeBP(nativeBP);
    await treasury.setFeeEnabled(true);
    // uln
    await ultraLightNode.setLayerZeroToken(lzToken.address);
    await ultraLightNode.setTreasury(treasury.address);

    // automated deploy settings
    // oracle
    await oracle.setUln(ultraLightNode.address);
    for (let id of chainIds) {
        await oracle.setPrice(id, outboundProofType, oracleFee);
        await oracle.setPrice(id, outboundProofType2, oracleFee);
    }
    // lzEndpoint
    await lzEndpoint.newVersion(ultraLightNode.address);
    await lzEndpoint.setDefaultSendVersion(1);
    await lzEndpoint.setDefaultReceiveVersion(1);

    return {
        ultraLightNode,
        oracle,
        relayer,
        treasury,
        counterMock,
        pingPong,
        evmValidator,
        nonceContract,
        outboundProofType: inboundProofType,
        name: ID_TO_CHAIN_NAME[endpoint.chainId],
        version,
        ...endpoint,
    };
};

wireOmniCounters = async (endpoints, ulnv2 = false) => {
    await Promise.all(
        endpoints.map(async (srcEndpoint) => {
            // give counterMock tokens to spend
            await srcEndpoint.lzToken.transfer(srcEndpoint.counterMock.address, 10000);
            // approve the node to spend tokens on our behalf, eg. pay the relayer and oracle
            await srcEndpoint.counterMock.approveTokenSpender(
                srcEndpoint.lzToken.address,
                srcEndpoint.ultraLightNode.address,
                10000
            );

            // set the counterMock the trusted remote
            await Promise.all(
                endpoints.map(async (dstEndpoint) => {
                    await srcEndpoint.counterMock.setTrustedRemote(
                        dstEndpoint.chainId,
                        ulnv2
                            ? encodePackedParams(
                                  ['address', 'address'],
                                  [dstEndpoint.counterMock.address, srcEndpoint.counterMock.address]
                              )
                            : dstEndpoint.counterMock.address
                    );
                })
            );
        })
    );
};

// Tricks ethers js into thinking this contract has access to these functions. This is used to force a call to a contract
// that doesnt contain the function in its generated abi, and as a result it will proxy the call into the _implementation() contract
applyInterfaceToContract = (contract, contractToCopy) => {
    let interfaceFunctions = Object.fromEntries(
        Object.entries(contractToCopy).filter(([, y]) => typeof y == 'function')
    );
    contract = { ...contract, ...interfaceFunctions };
    return contract;
};

encodeParams = (types, values, packed = false) => {
    if (!packed) {
        return web3.eth.abi.encodeParameters(types, values);
    } else {
        return ethers.utils.solidityPack(types, values);
    }
};

encodePackedParams = (types, values) => {
    return encodeParams(types, values, true);
};

decodeParam = (type, value) => {
    return web3.eth.abi.decodeParameter(type, value);
};

decodeParams = (types, value) => {
    return web3.eth.abi.decodeParameters(types, value);
};

txTouchedAddress = async (tx, address) => {
    const trace = await hre.network.provider.send('debug_traceTransaction', [tx.hash]);
    const opCalls = trace.structLogs.filter((x) => x.op === 'CALL');
    const addr = address.toLowerCase().split('x')[1];

    // not fully optimised, we could check for these as filtering, but not important for the test cases we are doing
    for (const op of opCalls) {
        for (const stack of op.stack) {
            if (stack.includes(addr)) {
                return true;
            }
        }
    }

    return false;
};

// dstPriceRatio and price for a relayer gas fee
getRatioAndPrice = (values = {}, typeTwo = false) => {
    const { denominator, dstPrice, srcPrice, dstNativeAmt, dstGasPrice, baseGas, extraGas, payloadLength, gasPerByte } =
        values;

    const _denominator = denominator || VARS.denominator;
    const _dstPrice = dstPrice || VARS.dstPrice;
    const _srcPrice = srcPrice || VARS.srcPrice;

    // type 1 transaction, do not include dst native gas in the price formula
    const _dstNativeAmount = typeTwo ? dstNativeAmt || VARS.dstNativeAmt : 0;
    const _dstGasPrice = dstGasPrice || VARS.dstGasPrice;
    const _baseGas = baseGas || VARS.baseGas;
    const _extraGas = extraGas || VARS.extraGas;
    const _payloadLength = payloadLength || VARS.payloadLength;
    const _gasPerByte = gasPerByte || VARS.gasPerByte;

    const dstPriceRatio = (_dstPrice * _denominator) / _srcPrice;

    const basePrice = ((_dstNativeAmount + _dstGasPrice * (_baseGas + _extraGas)) * dstPriceRatio) / _denominator;
    const pricePerByte = (_dstGasPrice * _gasPerByte * dstPriceRatio) / _denominator;
    const expectedPrice = basePrice + pricePerByte * _payloadLength;

    return { dstPriceRatio, expectedPrice };
};

getRatioAndPriceType2 = (values = {}) => {
    return getRatioAndPrice(values, true);
};
getRatioAndPriceType1 = (values = {}) => {
    return getRatioAndPrice(values);
};

getPairs = (lengthOfArray) => {
    let pairs = [];
    for (let i = 0; i < lengthOfArray - 1; i++) {
        for (let j = i; j < lengthOfArray - 1; j++) {
            pairs.push([i, j + 1]);
            pairs.push([j + 1, i]);
        }
    }
    return pairs;
};

setRelayer = async (uln, endpoint, ua, relayer, chainId) => {
    return await callAsContract(uln, endpoint.address, 'setConfig(uint16,address,uint256,bytes)', [
        chainId,
        ua.address,
        CONFIG_TYPE_RELAYER,
        encodeParams(['address'], [relayer.address]),
    ]);
};

setOracle = async (uln, endpoint, ua, oracle, chainId) => {
    return await callAsContract(uln, endpoint.address, 'setConfig(uint16,address,uint256,bytes)', [
        chainId,
        ua.address,
        CONFIG_TYPE_ORACLE,
        encodeParams(['address'], [oracle.address]),
    ]);
};

setOutboundProofType = async (uln, endpoint, ua, proofType, chainId) => {
    return await callAsContract(uln, endpoint.address, 'setConfig(uint16,address,uint256,bytes)', [
        chainId,
        ua.address,
        CONFIG_TYPE_OUTBOUND_PROOF_TYPE,
        encodeParams(['uint16'], [proofType]),
    ]);
};

setOutboundBlockConfirmations = async (uln, endpoint, ua, confirmations, chainId) => {
    return await callAsContract(uln, endpoint.address, 'setConfig(uint16,address,uint256,bytes)', [
        chainId,
        ua.address,
        CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS,
        encodeParams(['uint16'], [confirmations]),
    ]);
};

setInboundBlockConfirmations = async (uln, endpoint, ua, confirmations, chainId) => {
    return await callAsContract(uln, endpoint.address, 'setConfig(uint16,address,uint256,bytes)', [
        chainId,
        ua.address,
        CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS,
        encodeParams(['uint16'], [confirmations]),
    ]);
};

setInboundProofLibraryVersion = async (uln, endpoint, ua, libraryVersion, chainId) => {
    return await callAsContract(uln, endpoint.address, 'setConfig(uint16,address,uint256,bytes)', [
        chainId,
        ua.address,
        CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION,
        encodeParams(['uint16'], [libraryVersion]),
    ]);
};

getOutboundProofType = async (uln, ua, chainId) => {
    return parseInt(decodeParam('uint16', await uln.getConfig(chainId, ua.address, CONFIG_TYPE_OUTBOUND_PROOF_TYPE)));
};

module.exports = {
    getBlock,
    getValidateFunction,
    getAddr,
    checkBalance,
    checkTokenBalance,
    getBalance,
    callAsContract,
    generateEndpoints,
    generateVersion,
    deployNew,
    wireOmniCounters,
    encodeParams,
    encodePackedParams,
    txTouchedAddress,
    decodeParam,
    decodeParams,
    getRatioAndPriceType1,
    getRatioAndPriceType2,
    getPairs,
    checkInboundNonce,
    checkOutboundNonce,
    checkInboundNonceV2,
    checkOutboundNonceV2,
    checkCounter,
    checkCounters,
    setRelayer,
    setOracle,
    setOutboundProofType,
    setOutboundBlockConfirmations,
    setInboundBlockConfirmations,
    setInboundProofLibraryVersion,
    getOutboundProofType,
};
