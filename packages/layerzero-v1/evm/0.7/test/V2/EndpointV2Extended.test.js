const { expect } = require('chai');
const { wireEndpoints, deliverMsg, deliverRelayer, deliverOracle } = require('../util/helpers');
const {
    getAddr,
    generateEndpoints,
    generateVersion,
    getOutboundProofType,
    setRelayer,
    setInboundBlockConfirmations,
    setOracle,
    setInboundProofLibraryVersion,
    checkCounters,
    checkOutboundNonceV2,
    checkInboundNonceV2,
    checkOutboundNonce,
    checkInboundNonce,
    decodeParam,
    wireOmniCounters,
} = require('../../utils/helpers');
const { deployments, ethers, network, web3 } = require('hardhat');
const { VARS } = require('../../utils/constants');
const abiDecoder = require('abi-decoder');
const endpointAbi = require('@layerzerolabs/lz-evm-v1-0.7/artifacts/contracts/Endpoint.sol/Endpoint.json');
abiDecoder.addABI([...endpointAbi.abi]);

describe('Endpoint V2 Extended:', function () {
    let chainIds = [1, 2];
    let unwiredEndpoints, src, dst, user1, user2, deployer, fakeContract;
    let { outboundProofType, defaultMsgValue, zroFee } = VARS;
    let v2 = true;

    before(async function () {
        ({ user1, user2, deployer, fakeContract } = await getAddr(ethers));
    });

    beforeEach(async function () {
        await deployments.fixture(['test']);

        const _endpoints = await generateEndpoints(chainIds);
        unwiredEndpoints = await Promise.all(
            _endpoints.map(async (endpoint, index) => {
                //todo: chainlink oracle client for v2
                return await generateVersion(endpoint, chainIds, outboundProofType, 1, false, v2);
            })
        );
        const wiredEndpoints = await wireEndpoints(unwiredEndpoints, true, v2);

        src = wiredEndpoints[0];
        dst = wiredEndpoints[1];

        // give counterMock tokens to spend
        await src.lzToken.transfer(src.counterMock.address, 10000);
        await dst.lzToken.transfer(dst.counterMock.address, 10000);
        // approve the node to spend tokens on our behalf, eg. pay the relayer and oracle
        await src.counterMock.approveTokenSpender(src.lzToken.address, src.ultraLightNode.address, 10000);
        await dst.counterMock.approveTokenSpender(dst.lzToken.address, dst.ultraLightNode.address, 10000);
    });

    it("incrementCounter() - reverts with 'invalid _packet.ulnAddress'", async function () {
        let v2 = true;
        // needs a unwired version of the endpoints so we can set a bad contract to uln
        unwiredEndpoints = [];
        for (const endpoint of await generateEndpoints(chainIds)) {
            unwiredEndpoints.push(await generateVersion(endpoint, chainIds, outboundProofType, 1, false, v2));
        }
        // pass a false flag to ensure we dont actually wire these together
        [src, dst] = await wireEndpoints(unwiredEndpoints, false, v2);

        const dstUlnBytes32 = ethers.utils.hexZeroPad(dst.ultraLightNode.address, 32);
        await src.ultraLightNode.setRemoteUln(dst.chainId, dstUlnBytes32);
        // purposely set a rogue remote ultraLightNode address
        await dst.ultraLightNode.setRemoteUln(src.chainId, dstUlnBytes32);

        await src.lzToken.transfer(src.counterMock.address, zroFee);
        await src.counterMock.approveTokenSpender(src.lzToken.address, src.ultraLightNode.address, zroFee);

        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', '0x', { value: defaultMsgValue });

        // using the same transaction proof from the relayer should result in a revert
        await expect(deliverMsg(tx, src, dst, dst.counterMock.address)).to.be.revertedWith(
            'LayerZero: invalid _packet.ulnAddress'
        );
    });

    it("validateTransactionProof() - reverts with 'invalid srcChain Id'", async function () {
        const confirmations = 15;
        const gasLimit = 100000;
        const value = 0;
        const outboundProofType = await getOutboundProofType(src.ultraLightNode, src.counterMock, dst.chainId);

        // provide a rogue chainId
        const rogueChainId = 345;

        // set up a valid config for the rogue chainId
        const srcUlnAddressBytes32 = ethers.utils.hexZeroPad(src.ultraLightNode.address, 32);
        await dst.ultraLightNode.setRemoteUln(rogueChainId, srcUlnAddressBytes32);
        await dst.ultraLightNode.setChainAddressSize(rogueChainId, 20);
        await setRelayer(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, dst.relayer, rogueChainId);
        await setOracle(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, dst.oracle, rogueChainId);
        await setInboundBlockConfirmations(
            dst.ultraLightNode,
            dst.lzEndpoint,
            dst.counterMock,
            confirmations,
            rogueChainId
        );
        await dst.ultraLightNode.addInboundProofLibraryForChain(rogueChainId, dst.evmValidator.address);
        await setInboundProofLibraryVersion(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, 1, rogueChainId);

        // start a transaction
        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', '0x', { value: defaultMsgValue });

        await deliverOracle(tx, rogueChainId, dst.ultraLightNode, dst.oracle, confirmations);
        await expect(
            deliverRelayer(
                tx,
                rogueChainId,
                dst.ultraLightNode,
                dst.counterMock.address,
                dst.relayer,
                outboundProofType,
                gasLimit,
                value
            )
        ).to.be.revertedWith('LayerZero: invalid srcChain Id');
    });

    it("validateTransactionProof() - reverts with 'incorrect remote address size'", async function () {
        const confirmations = 15;
        const gasLimit = 100000;
        const value = 0;
        const outboundProofType = await getOutboundProofType(src.ultraLightNode, src.counterMock, dst.chainId);

        // provide a rogue chainId
        const rogueChainId = 345;

        // set up a valid config for the rogue chainId
        const srcUlnAddressBytes32 = ethers.utils.hexZeroPad(src.ultraLightNode.address, 32);
        await dst.ultraLightNode.setRemoteUln(rogueChainId, srcUlnAddressBytes32);
        // await dst.ultraLightNode.setChainAddressSize(rogueChainId, 20)
        await setRelayer(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, dst.relayer, rogueChainId);
        await setOracle(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, dst.oracle, rogueChainId);
        await setInboundBlockConfirmations(
            dst.ultraLightNode,
            dst.lzEndpoint,
            dst.counterMock,
            confirmations,
            rogueChainId
        );
        await dst.ultraLightNode.addInboundProofLibraryForChain(rogueChainId, dst.evmValidator.address);
        await setInboundProofLibraryVersion(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, 1, rogueChainId);

        // start a transaction
        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', '0x', { value: defaultMsgValue });

        await deliverOracle(tx, rogueChainId, dst.ultraLightNode, dst.oracle, confirmations);
        await expect(
            deliverRelayer(
                tx,
                rogueChainId,
                dst.ultraLightNode,
                dst.counterMock.address,
                dst.relayer,
                outboundProofType,
                gasLimit,
                value
            )
        ).to.be.revertedWith('LayerZero: incorrect remote address size');
    });

    it("validateTransactionProof() - reverts with 'LayerZero: invalid srcAddress size'", async function () {
        const confirmations = 15;
        const gasLimit = 100000;
        const value = 0;
        const badChainAddressSize = 21;
        const outboundProofType = await getOutboundProofType(src.ultraLightNode, src.counterMock, dst.chainId);

        // provide a rogue chainId
        const rogueChainId = 345;

        // set up a valid config for the rogue chainId
        const srcUlnAddressBytes32 = ethers.utils.hexZeroPad(src.ultraLightNode.address, 32);
        await dst.ultraLightNode.setRemoteUln(rogueChainId, srcUlnAddressBytes32);
        await dst.ultraLightNode.setChainAddressSize(rogueChainId, badChainAddressSize);
        await setRelayer(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, dst.relayer, rogueChainId);
        await setOracle(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, dst.oracle, rogueChainId);
        await setInboundBlockConfirmations(
            dst.ultraLightNode,
            dst.lzEndpoint,
            dst.counterMock,
            confirmations,
            rogueChainId
        );
        await dst.ultraLightNode.addInboundProofLibraryForChain(rogueChainId, dst.evmValidator.address);
        await setInboundProofLibraryVersion(dst.ultraLightNode, dst.lzEndpoint, dst.counterMock, 1, rogueChainId);

        // start a transaction
        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', '0x', { value: defaultMsgValue });

        await deliverOracle(tx, rogueChainId, dst.ultraLightNode, dst.oracle, confirmations);
        await expect(
            deliverRelayer(
                tx,
                rogueChainId,
                dst.ultraLightNode,
                dst.counterMock.address,
                dst.relayer,
                outboundProofType,
                gasLimit,
                value
            )
        ).to.be.revertedWith('SafeMath: subtraction overflow'); // 21 > 20. overflowing the bytes slicing
    });

    it("validateTransactionProof() - reverts with 'LayerZero: invalid dstChain Id'", async function () {
        // send a transaction across
        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', '0x', { value: defaultMsgValue });

        // reroute the message to the wrong chain
        await expect(deliverMsg(tx, src, src, dst.counterMock.address, { gasLimit: 100000 })).to.be.revertedWith(
            'LayerZero: invalid dstChain Id'
        );
    });

    it("validateTransactionProof() - reverts with 'invalid dst address'", async function () {
        // send a transaction across
        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', '0x', { value: defaultMsgValue });

        // try to send to the wrong dst address, ie the src, not the dst countermock
        await expect(deliverMsg(tx, src, dst, src.counterMock.address, { gasLimit: 100000 })).to.be.revertedWith(
            'LayerZero: invalid dstAddress'
        );
    });

    it('setDefaultReceiveVersion() and setDefaultSendVersion - allows us to go through different uln versions', async function () {
        // generate new version with the old ulnv1
        const _endpoints = [
            {
                lzEndpoint: src.lzEndpoint,
                lzToken: src.lzToken,
                mockLinkToken: src.mockLinkToken,
                chainId: src.chainId,
            },
            {
                lzEndpoint: dst.lzEndpoint,
                lzToken: dst.lzToken,
                mockLinkToken: dst.mockLinkToken,
                chainId: dst.chainId,
            },
        ];
        unwiredEndpoints = await Promise.all(
            _endpoints.map(async (endpoint, index) => {
                return await generateVersion(endpoint, chainIds, outboundProofType); // purposely setup v1 ulns
            })
        );
        const wiredEndpoints = await wireEndpoints(unwiredEndpoints);
        await wireOmniCounters(wiredEndpoints);
        const srcV1 = wiredEndpoints[0];
        const dstV1 = wiredEndpoints[1];
        const srcV2 = src;
        const dstV2 = dst;

        // set version to the original ulnv1
        await expect(srcV1.lzEndpoint.setDefaultSendVersion(2))
            .to.emit(srcV1.lzEndpoint, 'DefaultSendVersionSet')
            .withArgs(2);
        await expect(dstV1.lzEndpoint.setDefaultSendVersion(2))
            .to.emit(dstV1.lzEndpoint, 'DefaultSendVersionSet')
            .withArgs(2);
        await expect(srcV1.lzEndpoint.setDefaultReceiveVersion(2))
            .to.emit(srcV1.lzEndpoint, 'DefaultReceiveVersionSet')
            .withArgs(2);
        await expect(dstV1.lzEndpoint.setDefaultReceiveVersion(2))
            .to.emit(dstV1.lzEndpoint, 'DefaultReceiveVersionSet')
            .withArgs(2);

        // increment the counter
        let tx = await srcV1.counterMock.incrementCounter(dstV1.chainId, '0x', '0x', { value: defaultMsgValue });
        await deliverMsg(tx, srcV1, dstV1, dstV1.counterMock.address, { gasLimit: 100000 });
        tx = await srcV1.counterMock.incrementCounter(dstV1.chainId, '0x', '0x', { value: defaultMsgValue });
        await deliverMsg(tx, srcV1, dstV1, dstV1.counterMock.address, { gasLimit: 100000 });

        // counters updated
        await checkCounters(srcV1, dstV1, 0, 2);
        await checkCounters(srcV2, dstV2, 0, 0);

        // check the ulnv1 nonces are updated
        await checkOutboundNonce(srcV1, dstV1, 2);
        await checkInboundNonce(dstV1, srcV1, 2);

        // make sure ulnv2 nonces are NOT updated
        await checkOutboundNonceV2(srcV2, dstV2, 0);
        await checkInboundNonceV2(dstV2, srcV2, 0);

        // switch to ulnv2 version
        await expect(srcV1.lzEndpoint.setDefaultSendVersion(1))
            .to.emit(srcV1.lzEndpoint, 'DefaultSendVersionSet')
            .withArgs(1);
        await expect(dstV1.lzEndpoint.setDefaultSendVersion(1))
            .to.emit(dstV1.lzEndpoint, 'DefaultSendVersionSet')
            .withArgs(1);
        await expect(srcV1.lzEndpoint.setDefaultReceiveVersion(1))
            .to.emit(srcV1.lzEndpoint, 'DefaultReceiveVersionSet')
            .withArgs(1);
        await expect(dstV1.lzEndpoint.setDefaultReceiveVersion(1))
            .to.emit(dstV1.lzEndpoint, 'DefaultReceiveVersionSet')
            .withArgs(1);

        // increment the counter
        tx = await srcV2.counterMock.incrementCounter(dstV2.chainId, '0x', '0x', { value: defaultMsgValue });
        await deliverMsg(tx, srcV2, dstV2, dstV2.counterMock.address, { gasLimit: 100000 });
        tx = await srcV2.counterMock.incrementCounter(dstV2.chainId, '0x', '0x', { value: defaultMsgValue });
        await deliverMsg(tx, srcV2, dstV2, dstV2.counterMock.address, { gasLimit: 100000 });
        tx = await srcV2.counterMock.incrementCounter(dstV2.chainId, '0x', '0x', { value: defaultMsgValue });
        await deliverMsg(tx, srcV2, dstV2, dstV2.counterMock.address, { gasLimit: 100000 });

        // counters updated
        await checkCounters(srcV1, dstV1, 0, 2);
        await checkCounters(srcV2, dstV2, 0, 3);

        // check the ulnv1 nonces are NOT updated
        await checkOutboundNonce(srcV1, dstV1, 2);
        await checkInboundNonce(dstV1, srcV1, 2);

        // make sure ulnv2 nonces are updated
        await checkOutboundNonceV2(srcV2, dstV2, 3);
        await checkInboundNonceV2(dstV2, srcV2, 3);

        // increment the counter on the v1 counter which is now on ulnV2. Trusted remote haven't been set so the call should revert
        await expect(
            srcV1.counterMock.incrementCounter(dstV1.chainId, '0x', '0x', { value: defaultMsgValue })
        ).to.be.revertedWith('LayerZero: incorrect remote address size');

        // wiring the trusted remote for ulnv2 with path data
        await wireOmniCounters(wiredEndpoints, true);

        tx = await srcV1.counterMock.incrementCounter(dstV1.chainId, '0x', '0x', { value: defaultMsgValue });
        await deliverMsg(tx, srcV2, dstV2, dstV1.counterMock.address, { gasLimit: 100000 });

        // The counter is incremented
        await checkCounters(srcV1, dstV1, 0, 3);

        // Check the outbound nonce on uln V2
        const path = encodePackedParams(['address', 'address'], [dstV1.counterMock.address, srcV1.counterMock.address]);
        expect(await srcV2.ultraLightNode.getOutboundNonce(dstV1.chainId, path)).to.equal(1);
        // Check the inbound nonce on uln V2
        await checkInboundNonceV2(dstV1, srcV1, 1);
    });

    it('validateTransactionProof() - reverts if the dstAddress is not a contract, emits event and silent return', async function () {
        // send a transaction across
        await src.counterMock.setTrustedRemote(
            dst.chainId,
            encodePackedParams(['address', 'address'], [fakeContract.address, src.counterMock.address])
        );
        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', '0x', { value: defaultMsgValue });

        const payloadHash = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

        // fakeContract is an eoa
        await expect(deliverMsg(tx, src, dst, fakeContract.address, { gasLimit: 100000 }))
            .to.emit(dst.ultraLightNode, 'InvalidDst')
            .withArgs(src.chainId, src.counterMock.address.toLowerCase(), fakeContract.address, 1, payloadHash);
    });

    it('send() / validateTransactionProof() - assert the packet contents emited in the event match', async function () {
        const payloadToSend = '0x66661234';
        // send a transaction across
        const tx = await src.counterMock.incrementCounter(dst.chainId, '0x', payloadToSend, {
            value: defaultMsgValue,
        });

        // get packet emitted from the ulnv2
        const receipt = await network.provider.send('eth_getTransactionReceipt', [tx.hash]);
        // keccak256(Packet(bytes)) == 0xe9bded5f24a4168e4f3bf44e00298c993b22376aad8c58c7dda9718a54cbea82
        const logIndex = receipt.logs.findIndex(
            (x) => x.topics[0].toString() === '0xe9bded5f24a4168e4f3bf44e00298c993b22376aad8c58c7dda9718a54cbea82'
        );
        if (logIndex === -1) throw 'event not emited';
        const data = decodeParam('bytes', receipt.logs[logIndex].data);

        // event params
        const nonce = parseInt(data.substring(2, 18), 16);
        const localChainId = parseInt(data.substring(18, 22), 16);
        const ua = '0x' + data.substring(22, 62);
        const dstChainId = parseInt(data.substring(62, 66), 16);
        const dstAddress = '0x' + data.substring(66, 106);
        // keccak256([empty bytes]) == "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        const payloadHash =
            data.length > 106
                ? web3.utils.keccak256('0x' + data.substring(106, data.length))
                : '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

        await expect(deliverMsg(tx, src, dst, dst.counterMock.address, { gasLimit: 100000 }))
            .to.emit(dst.ultraLightNode, 'PacketReceived')
            .withArgs(localChainId, ua.toLowerCase(), web3.utils.toChecksumAddress(dstAddress), nonce, payloadHash);
    });
});
