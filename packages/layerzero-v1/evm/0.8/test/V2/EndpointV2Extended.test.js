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
    decodeParam,
} = require('../../../0.7/utils/helpers');
const { deployments, ethers, network, web3 } = require('hardhat');
const { VARS } = require('../../../0.7/utils/constants');
const abiDecoder = require('abi-decoder');
const endpointAbi = require('@layerzerolabs/lz-evm-sdk-v1/artifacts/contracts/Endpoint.sol/Endpoint.json');
abiDecoder.addABI([...endpointAbi.abi]);

describe('Endpoint V2 Extended:', function () {
    let chainIds = [1, 2];
    let unwiredEndpoints, src, dst, user1, user2, deployer, fakeContract;
    let { outboundProofType2, defaultMsgValue, zroFee } = VARS;
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
                return await generateVersion(endpoint, chainIds, outboundProofType2, 1, false, v2, true);
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
        for (const endpoint of await generateEndpoints(chainIds, false)) {
            unwiredEndpoints.push(await generateVersion(endpoint, chainIds, outboundProofType2, 1, false, v2, true));
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
        ).to.be.revertedWith('LayerZeroPacket: invalid packet'); // 21 > 20. overflowing the bytes slicing
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
