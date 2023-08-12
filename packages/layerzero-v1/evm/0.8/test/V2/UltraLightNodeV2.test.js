const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');

const {
    ZERO_ADDRESS,
    CONFIG_TYPE_RELAYER,
    CONFIG_TYPE_ORACLE,
    CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS,
    CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION,
    CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS,
    CONFIG_TYPE_OUTBOUND_PROOF_TYPE,
    VARS,
} = require('../../../0.7/utils/constants');
const {
    getAddr,
    callAsContract,
    deployNew,
    getBalance,
    decodeParam,
    encodePackedParams,
    generateEndpoints,
    generateVersion,
    setOracle,
    setRelayer,
    setOutboundProofType,
    setOutboundBlockConfirmations,
    setInboundBlockConfirmations,
    setInboundProofLibraryVersion,
} = require('../../../0.7/utils/helpers');
const { DEFAULT_APP_CONFIG_VALUES } = require('../util/constants');
const { wireEndpoints } = require('../util/helpers');

describe('UltraLightNodeV2:', function () {
    let chainId = 1;
    let chainIds = [chainId];
    let randomChainId = 12345;
    let user1,
        fakeContract,
        badUser1,
        approvedOracle,
        userApplication,
        oracle,
        relayer,
        ultraLightNode,
        lzEndpoint,
        treasury,
        lzToken,
        relayerWithdraw;
    let { outboundProofType2, zroFee, txParams, adapterParams, defaultBlockConfirmations, emptyBytes32 } = VARS;
    let v2 = true;

    before(async function () {
        ({ user1, user2: approvedOracle, badUser1, fakeContract } = await getAddr(ethers));
    });

    beforeEach(async function () {
        await deployments.fixture(['test']);

        let endpoints = await generateEndpoints(chainIds, true); // needs semicolon or object destructuring assignment breaks rip
        ({
            oracle,
            relayer,
            lzEndpoint,
            ultraLightNode,
            treasury,
            lzToken,
            relayerWithdraw,
            counterMock: userApplication,
        } = (
            await wireEndpoints(
                [await generateVersion(endpoints[0], chainIds, outboundProofType2, 1, true, v2, true)],
                true,
                v2
            )
        )[0]);

        // UA has ZRO to spend
        await lzToken.transfer(userApplication.address, zroFee * 2);
        // give ultraLightNode allowance to transfer ZRO on the UA behalf
        await callAsContract(lzToken, userApplication.address, 'approve(address,uint256)', [
            ultraLightNode.address,
            zroFee * 2,
        ]);
    });

    it('constructor()', async function () {
        expect(await ultraLightNode.endpoint()).to.equal(lzEndpoint.address);
    });

    it('constructor() - reverts with 0x0 endpoint', async function () {
        await expect(deployNew('UltraLightNodeV2', [ZERO_ADDRESS, fakeContract.address, chainId])).to.revertedWith(
            'LayerZero: endpoint cannot be zero address'
        );
    });

    it('constructor() - reverts with 0x0 nonce contract', async function () {
        await expect(deployNew('UltraLightNodeV2', [lzEndpoint.address, ZERO_ADDRESS, chainId])).to.revertedWith(
            'LayerZero: nonceContract cannot be zero address'
        );
    });

    // it('constructor() - reverts with wrong endpoint', async function () {
    //     let wrongEndpoint = fakeContract; // EOA
    //     await expect(deployNew('UltraLightNodeV2', [wrongEndpoint.address, fakeContract.address, chainId])).to.reverted;
    //
    //     wrongEndpoint = ultraLightNode; // contract
    //     await expect(deployNew('UltraLightNodeV2', [wrongEndpoint.address, fakeContract.address, chainId])).to.reverted;
    // });

    it('getConfig() - reverts when invalid config type requested', async function () {
        await expect(ultraLightNode.getConfig(1, fakeContract.address, 123)).to.revertedWith(
            'LayerZero: Invalid config type'
        );
    });

    it('getOracle() - defaults', async function () {
        expect(
            decodeParam(
                'address',
                await ultraLightNode.getConfig(randomChainId, fakeContract.address, CONFIG_TYPE_ORACLE)
            )
        ).to.equal(ZERO_ADDRESS);
    });

    it('getRelayer() - defaults', async function () {
        expect(
            decodeParam(
                'address',
                await ultraLightNode.getConfig(randomChainId, fakeContract.address, CONFIG_TYPE_RELAYER)
            )
        ).to.equal(ZERO_ADDRESS);
    });

    it('getInboundBlockConfirmations() - defaults', async function () {
        expect(
            parseInt(
                decodeParam(
                    'uint256',
                    await ultraLightNode.getConfig(
                        randomChainId,
                        fakeContract.address,
                        CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS
                    )
                )
            )
        ).to.equal(0);
    });

    it('getOutboundBlockConfirmations() - defaults', async function () {
        expect(
            parseInt(
                decodeParam(
                    'uint256',
                    await ultraLightNode.getConfig(
                        randomChainId,
                        fakeContract.address,
                        CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS
                    )
                )
            )
        ).to.equal(0);
    });

    it('setLayerZeroToken(): reverts when 0x0', async function () {
        await expect(ultraLightNode.setLayerZeroToken(ZERO_ADDRESS)).to.be.revertedWith(
            'LayerZero: _layerZeroToken cannot be zero address'
        );
    });

    it('setLayerZeroToken(): reverts when non owner', async function () {
        await expect(ultraLightNode.connect(badUser1).setLayerZeroToken(fakeContract.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('setLayerZeroToken(): emit event / set', async function () {
        await expect(ultraLightNode.setLayerZeroToken(fakeContract.address))
            .to.emit(ultraLightNode, 'SetLayerZeroToken')
            .withArgs(fakeContract.address);
        expect(await ultraLightNode.layerZeroToken()).to.equal(fakeContract.address);
    });

    it('setTreasury() - reverts when 0x0', async function () {
        await expect(ultraLightNode.setTreasury(ZERO_ADDRESS)).to.be.revertedWith(
            'LayerZero: treasury cannot be zero address'
        );
    });

    it('setTreasury() - reverts when non owner', async function () {
        await expect(ultraLightNode.connect(badUser1).setTreasury(fakeContract.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('setTreasury() - emit event / set', async function () {
        await expect(ultraLightNode.setTreasury(fakeContract.address))
            .to.emit(ultraLightNode, 'SetTreasury')
            .withArgs(fakeContract.address);
        expect(await ultraLightNode.treasuryContract()).to.equal(fakeContract.address);
    });

    it('setDefaultAdapterParamsForChainId() - reverts when non owner', async function () {
        await expect(
            ultraLightNode.connect(badUser1).setDefaultAdapterParamsForChainId(chainId, outboundProofType2, '0x')
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('setDefaultAdapterParamsForChainId() - emit event / set', async function () {
        const _outboundProofType = 123;
        await expect(ultraLightNode.setDefaultAdapterParamsForChainId(chainId, _outboundProofType, '0x11'))
            .to.emit(ultraLightNode, 'SetDefaultAdapterParamsForChainId')
            .withArgs(chainId, _outboundProofType, '0x11');
        expect(await ultraLightNode.defaultAdapterParams(chainId, _outboundProofType)).to.equal('0x11');
    });

    it('setRemoteUln() - reverts when non owner', async function () {
        const _data = '0x0000000000000000000000000000000000000000000000000000000000000000';
        await expect(ultraLightNode.connect(badUser1).setRemoteUln(chainId, _data)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('setRemoteUln() - emit event / set', async function () {
        const _ultraLightNode = await deployNew('UltraLightNodeV2', [lzEndpoint.address, fakeContract.address, 1]);
        const _data = '0x0000000000000000000000000000000000000000000000000000000000000001';
        await expect(_ultraLightNode.setRemoteUln(chainId, _data))
            .to.emit(_ultraLightNode, 'SetRemoteUln')
            .withArgs(chainId, _data);
        expect(await _ultraLightNode.ulnLookup(chainId)).to.equal(_data);
    });

    it('enableSupportedOutboundProof() - reverts when non owner', async function () {
        await expect(
            ultraLightNode.connect(badUser1).enableSupportedOutboundProof(chainId, outboundProofType2)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('enableSupportedOutboundProof() - emit event / set', async function () {
        const _outboundProofType = 123;
        await expect(ultraLightNode.enableSupportedOutboundProof(chainId, _outboundProofType))
            .to.emit(ultraLightNode, 'EnableSupportedOutboundProof')
            .withArgs(chainId, _outboundProofType);
        expect(await ultraLightNode.supportedOutboundProof(chainId, _outboundProofType)).to.equal(true);
    });

    describe('setConfig()', function () {
        it('reverts when invalid type is sent', async function () {
            await expect(
                callAsContract(ultraLightNode, lzEndpoint.address, 'setConfig(uint16,address,uint256,bytes)', [
                    0,
                    user1.address,
                    123,
                    '0x',
                ])
            ).to.be.revertedWith('LayerZero: Invalid config type');
        });

        it('CONFIG_TYPE_RELAYER - emits event / set', async function () {
            let chainId = 333;
            await expect(setRelayer(ultraLightNode, lzEndpoint, userApplication, relayer, chainId)).to.emit(
                ultraLightNode,
                'AppConfigUpdated'
            );
            expect(
                decodeParam(
                    'address',
                    await ultraLightNode.getConfig(chainId, userApplication.address, CONFIG_TYPE_RELAYER)
                )
            ).to.equal(relayer.address);
        });

        it('CONFIG_TYPE_ORACLE - emits event / set', async function () {
            let chainId = 222;
            await expect(setOracle(ultraLightNode, lzEndpoint, userApplication, oracle, chainId)).to.emit(
                ultraLightNode,
                'AppConfigUpdated'
            );
            expect(
                decodeParam(
                    'address',
                    await ultraLightNode.getConfig(chainId, userApplication.address, CONFIG_TYPE_ORACLE)
                )
            ).to.equal(oracle.address);
        });

        it('CONFIG_TYPE_OUTBOUND_PROOF_TYPE - emits event / set', async function () {
            // Have multiple versions available
            const proofTypeB = 17;
            await ultraLightNode.enableSupportedOutboundProof(chainId, proofTypeB);

            // init to default
            expect(
                decodeParam(
                    'uint16',
                    await ultraLightNode.getConfig(chainId, userApplication.address, CONFIG_TYPE_OUTBOUND_PROOF_TYPE)
                )
            ).to.equal(outboundProofType2.toString());

            // set to non default
            await expect(
                setOutboundProofType(ultraLightNode, lzEndpoint, userApplication, proofTypeB, chainId)
            ).to.emit(ultraLightNode, 'AppConfigUpdated');

            expect(
                decodeParam(
                    'uint16',
                    await ultraLightNode.getConfig(chainId, userApplication.address, CONFIG_TYPE_OUTBOUND_PROOF_TYPE)
                )
            ).to.equal(proofTypeB.toString());

            // back to default
            await setOutboundProofType(ultraLightNode, lzEndpoint, userApplication, 0, chainId);
            expect(
                decodeParam(
                    'uint16',
                    await ultraLightNode.getConfig(chainId, userApplication.address, CONFIG_TYPE_OUTBOUND_PROOF_TYPE)
                )
            ).to.equal(outboundProofType2.toString());
        });

        it('CONFIG_TYPE_OUTBOUND_PROOF_TYPE - reverts with invalid proof type', async function () {
            let proofType = 13;

            await expect(
                setOutboundProofType(ultraLightNode, lzEndpoint, userApplication, proofType, chainId)
            ).to.revertedWith('LayerZero: invalid outbound proof type');
        });

        it('CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS - emits event / set', async function () {
            const blockConfirmations = 10;
            await expect(
                setOutboundBlockConfirmations(ultraLightNode, lzEndpoint, userApplication, blockConfirmations, chainId)
            ).to.emit(ultraLightNode, 'AppConfigUpdated');

            expect(
                parseInt(
                    decodeParam(
                        'uint256',
                        await ultraLightNode.getConfig(
                            chainId,
                            userApplication.address,
                            CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS
                        )
                    )
                )
            ).to.equal(blockConfirmations);
        });

        it('CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS - emits event / set', async function () {
            const blockConfirmations = 10;

            await expect(
                setInboundBlockConfirmations(ultraLightNode, lzEndpoint, userApplication, blockConfirmations, chainId)
            ).to.emit(ultraLightNode, 'AppConfigUpdated');

            expect(
                parseInt(
                    decodeParam(
                        'uint256',
                        await ultraLightNode.getConfig(
                            chainId,
                            userApplication.address,
                            CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS
                        )
                    )
                )
            ).to.equal(blockConfirmations);
        });

        it('CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION - reverts when greater than existing max version', async function () {
            let libraryVersion = 9999;
            await expect(
                setInboundProofLibraryVersion(ultraLightNode, lzEndpoint, userApplication, libraryVersion, chainId)
            ).to.be.revertedWith('LayerZero: invalid inbound proof library version');
        });

        it('CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION - emits event / set', async function () {
            // multiple versions available
            await ultraLightNode.addInboundProofLibraryForChain(chainId, user1.address);
            await ultraLightNode.addInboundProofLibraryForChain(chainId, user1.address);
            await ultraLightNode.addInboundProofLibraryForChain(chainId, user1.address);

            // init to default
            expect(
                decodeParam(
                    'uint16',
                    await ultraLightNode.getConfig(
                        chainId,
                        userApplication.address,
                        CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION
                    )
                )
            ).to.equal(DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion.toString());

            // set to non default
            await expect(
                setInboundProofLibraryVersion(
                    ultraLightNode,
                    lzEndpoint,
                    userApplication,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion + 1,
                    chainId
                )
            ).to.emit(ultraLightNode, 'AppConfigUpdated');

            expect(
                decodeParam(
                    'uint16',
                    await ultraLightNode.getConfig(
                        chainId,
                        userApplication.address,
                        CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION
                    )
                )
            ).to.equal((DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion + 1).toString());

            // back to default
            await setInboundProofLibraryVersion(
                ultraLightNode,
                lzEndpoint,
                userApplication,
                DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                chainId
            );
            expect(
                decodeParam(
                    'uint16',
                    await ultraLightNode.getConfig(
                        chainId,
                        userApplication.address,
                        CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION
                    )
                )
            ).to.equal(DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion.toString());
        });

        it('setDefaultConfigForChainId() - emits event / set', async function () {
            await ultraLightNode.addInboundProofLibraryForChain(1, user1.address);
            await ultraLightNode.enableSupportedOutboundProof(1, outboundProofType2);

            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    chainId,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                )
            )
                .to.emit(ultraLightNode, 'SetDefaultConfigForChainId')
                .withArgs(
                    chainId,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                );
        });

        it('setDefaultConfigForChainId() - reverts when non owner sets: default config for chainId', async function () {
            await ultraLightNode.addInboundProofLibraryForChain(1, user1.address);
            await ultraLightNode.enableSupportedOutboundProof(1, outboundProofType2);

            await expect(
                ultraLightNode
                    .connect(badUser1)
                    .setDefaultConfigForChainId(
                        1,
                        DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                        DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                        user1.address,
                        DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                        DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                        user1.address
                    )
            ).to.be.revertedWith('Ownable: caller is not the owner');

            // success if called by the owner
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                )
            ).to.not.be.reverted;
        });

        it('setDefaultConfigForChainId() - reverts when passing wrong values', async function () {
            await ultraLightNode.addInboundProofLibraryForChain(1, user1.address);
            await ultraLightNode.enableSupportedOutboundProof(1, outboundProofType2);
            // test inboundProofLibraryVersion == 0
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    0,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                )
            ).to.be.revertedWith('LayerZero: invalid inbound proof library version');

            // test inboundProofLibraryVersion > max
            const maxLibVersion = await ultraLightNode.maxInboundProofLibrary(1);
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    maxLibVersion + 1,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                )
            ).to.be.revertedWith('LayerZero: invalid inbound proof library version');

            // test inboundBlockConfirmations == 0
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    0,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                )
            ).to.be.revertedWith('LayerZero: invalid inbound block confirmation');

            // test _relayer == 0
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    ZERO_ADDRESS,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                )
            ).to.be.revertedWith('LayerZero: invalid relayer address');

            // test invalid supportedOutboundProof == 0
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    0,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    user1.address
                )
            ).to.be.revertedWith('LayerZero: invalid outbound proof type');

            // test outboundBlockConfirmations == 0
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    0,
                    user1.address
                )
            ).to.be.revertedWith('LayerZero: invalid outbound block confirmation');

            // test oracle == 0x0
            await expect(
                ultraLightNode.setDefaultConfigForChainId(
                    1,
                    DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion,
                    DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations,
                    user1.address,
                    DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                    DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations,
                    ZERO_ADDRESS
                )
            ).to.be.revertedWith('LayerZero: invalid oracle address');
        });

        it('getAppConfig()', async function () {
            // set to default values and ensure they are valid
            await setRelayer(ultraLightNode, lzEndpoint, userApplication, { address: ZERO_ADDRESS }, chainId);
            await setOracle(ultraLightNode, lzEndpoint, userApplication, { address: ZERO_ADDRESS }, chainId);
            await setOutboundProofType(ultraLightNode, lzEndpoint, userApplication, 0, chainId);
            await setOutboundBlockConfirmations(ultraLightNode, lzEndpoint, userApplication, 0, chainId);
            await setInboundBlockConfirmations(ultraLightNode, lzEndpoint, userApplication, 0, chainId);
            await setInboundProofLibraryVersion(ultraLightNode, lzEndpoint, userApplication, 0, chainId);

            const configA = await ultraLightNode.getAppConfig(chainId, userApplication.address);
            expect(configA[0]).to.equal(DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion);
            expect(configA[1]).to.equal(DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations);
            expect(configA[2]).to.equal(relayer.address);
            expect(configA[3]).to.equal(DEFAULT_APP_CONFIG_VALUES.outboundProofType);
            expect(configA[4]).to.equal(DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations);
            expect(configA[5]).to.equal(oracle.address);

            // add support for new proof and library
            await ultraLightNode.enableSupportedOutboundProof(chainId, DEFAULT_APP_CONFIG_VALUES.outboundProofType);
            await ultraLightNode.addInboundProofLibraryForChain(chainId, fakeContract.address);

            // non default values and they are changed
            await setRelayer(ultraLightNode, lzEndpoint, userApplication, user1, chainId);
            await setOracle(ultraLightNode, lzEndpoint, userApplication, fakeContract, chainId);
            await setOutboundProofType(
                ultraLightNode,
                lzEndpoint,
                userApplication,
                DEFAULT_APP_CONFIG_VALUES.outboundProofType,
                chainId
            );
            await setOutboundBlockConfirmations(
                ultraLightNode,
                lzEndpoint,
                userApplication,
                DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations + 1,
                chainId
            );
            await setInboundBlockConfirmations(
                ultraLightNode,
                lzEndpoint,
                userApplication,
                DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations + 1,
                chainId
            );
            await setInboundProofLibraryVersion(
                ultraLightNode,
                lzEndpoint,
                userApplication,
                DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion + 1,
                chainId
            );

            const configB = await ultraLightNode.getAppConfig(chainId, userApplication.address);
            expect(configB[0]).to.equal(DEFAULT_APP_CONFIG_VALUES.inboundProofLibraryVersion + 1);
            expect(configB[1]).to.equal(DEFAULT_APP_CONFIG_VALUES.inboundBlockConfirmations + 1);
            expect(configB[2]).to.equal(user1.address);
            expect(configB[3]).to.equal(DEFAULT_APP_CONFIG_VALUES.outboundProofType);
            expect(configB[4]).to.equal(DEFAULT_APP_CONFIG_VALUES.outboundBlockConfirmations + 1);
            expect(configB[5]).to.equal(fakeContract.address);
        });
    });

    it('getReceiveLibraryAddress()', async function () {
        const nonceContract = await deployNew('NonceContract', [lzEndpoint.address]);
        const ultraLightNodeV2 = await deployNew('UltraLightNodeV2', [lzEndpoint.address, nonceContract.address, 1]);
        expect(await lzEndpoint.newVersion(ultraLightNodeV2.address)).to.emit(lzEndpoint, 'NewLibraryVersionAdded');
        expect(await lzEndpoint.connect(user1).setSendVersion(2)).to.emit(lzEndpoint, 'UaSendVersionSet');
        expect(await lzEndpoint.connect(user1).setReceiveVersion(2)).to.emit(lzEndpoint, 'UaReceiveVersionSet');

        expect(await lzEndpoint.getReceiveLibraryAddress(user1.address)).to.not.equal(ultraLightNode.address);
        expect(await lzEndpoint.getReceiveLibraryAddress(user1.address)).to.equal(ultraLightNodeV2.address);
    });

    it('getSendLibraryAddress()', async function () {
        const nonceContract = await deployNew('NonceContract', [lzEndpoint.address]);
        const ultraLightNodeV2 = await deployNew('UltraLightNodeV2', [lzEndpoint.address, nonceContract.address, 1]);
        await lzEndpoint.newVersion(ultraLightNodeV2.address);
        await lzEndpoint.connect(user1).setSendVersion(2);
        await lzEndpoint.connect(user1).setReceiveVersion(2);

        expect(await lzEndpoint.getSendLibraryAddress(user1.address)).to.not.equal(ultraLightNode.address);
        expect(await lzEndpoint.getSendLibraryAddress(user1.address)).to.equal(ultraLightNodeV2.address);
    });

    it('send() - paying with native', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x00';
        const refundAddress = user1.address;
        const zroPaymentAddress = ZERO_ADDRESS; // going to pay in native

        const nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);

        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, txParams],
            1000000000
        );
    });

    it('send() - reverts if dstChainId length does not match', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x00';
        const refundAddress = userApplication.address;
        const zroPaymentAddress = user1.address;
        const randomChainId = 456;
        const randomNonce = 789;

        // set new uln lookup
        await ultraLightNode.setRemoteUln(
            randomChainId,
            '0x0000000000000000000000000000000000000000000000000000000000000001'
        );

        await expect(
            callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [
                    userApplication.address,
                    randomNonce,
                    randomChainId,
                    path,
                    payload,
                    refundAddress,
                    zroPaymentAddress,
                    txParams,
                ],
                1000000000
            )
        ).to.revertedWith('LayerZero: incorrect remote address size');
    });

    it('send() - reverts if data path is wrong', async function () {
        const wrongPath = ethers.constants.AddressZero.concat(ethers.constants.AddressZero.slice(2)); // remove 0x
        const payload = '0x00';
        const refundAddress = userApplication.address;
        const zroPaymentAddress = ZERO_ADDRESS;
        const nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);

        await expect(
            callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [
                    userApplication.address,
                    nonce,
                    chainId,
                    wrongPath,
                    payload,
                    refundAddress,
                    zroPaymentAddress,
                    txParams,
                ],
                1000000000
            )
        ).to.revertedWith('LayerZero: wrong path data');
    });

    it('send() - reverts if payment address is not sender or origin', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x00';
        const refundAddress = userApplication.address;
        const zroPaymentAddress = user1.address;

        // enable zro fee
        await treasury.setZroEnabled(true);
        await treasury.setZroFee(69);

        const nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);

        await expect(
            callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, txParams],
                1000000000
            )
        ).to.revertedWith('LayerZero: must be paid by sender or origin');
    });

    it('send() - reverts if not enough native to cover transaction', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x00';
        const refundAddress = userApplication.address;
        const zroPaymentAddress = ZERO_ADDRESS;

        const nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);

        await expect(
            callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, txParams],
                1
            )
        ).to.revertedWith('LayerZero: not enough native for fees');
    });

    it('send() - reverts if chainId does not exist', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x00';
        const refundAddress = userApplication.address;
        const zroPaymentAddress = ZERO_ADDRESS;
        const _chainId = 3;

        const nonce = await lzEndpoint.outboundNonce(_chainId, userApplication.address);

        await expect(
            callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [userApplication.address, nonce, _chainId, path, payload, refundAddress, zroPaymentAddress, txParams],
                1
            )
        ).to.revertedWith('LayerZero: dstChainId does not exist');
    });

    it('estimateFees() - send with no adapter params', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x666666'; // is 3 bytes
        const refundAddress = userApplication.address;
        const zroPaymentAddress = ZERO_ADDRESS;
        const payInZRO = false;

        const { nativeFee: nativeFeeEstimate } = await ultraLightNode.estimateFees(
            chainId,
            userApplication.address,
            payload,
            payInZRO,
            '0x'
        );

        let nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, '0x'],
            nativeFeeEstimate
        );

        nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, '0x'],
            nativeFeeEstimate
        );
    });

    it('send() - type 2 estimateFees', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x666666'; // is 3 bytes
        const refundAddress = userApplication.address;
        const zroPaymentAddress = ZERO_ADDRESS;
        const payInZRO = false;
        const adapterParamsType2 = encodePackedParams(adapterParams[2].types, adapterParams[2].values);

        const { nativeFee: nativeFeeEstimate } = await ultraLightNode.estimateFees(
            chainId,
            userApplication.address,
            payload,
            payInZRO,
            adapterParamsType2
        );

        let nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [
                userApplication.address,
                nonce,
                chainId,
                path,
                payload,
                refundAddress,
                zroPaymentAddress,
                adapterParamsType2,
            ],
            nativeFeeEstimate
        );

        nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [
                userApplication.address,
                nonce,
                chainId,
                path,
                payload,
                refundAddress,
                zroPaymentAddress,
                adapterParamsType2,
            ],
            nativeFeeEstimate
        );
    });

    it('send() - paying without ZRO, lzFee enabled', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x666666'; // is 3 bytes
        const payloadLength = 3; // ^^
        const refundAddress = userApplication.address;
        const zroPaymentAddress = ZERO_ADDRESS;
        const payInZRO = false;
        const encodedAdapterParams = encodePackedParams(
            adapterParams[outboundProofType2].types,
            adapterParams[outboundProofType2].values
        );

        // Expected fees to be increased/reduced by
        const relayerFee = await relayer.getFee(
            chainId,
            outboundProofType2,
            userApplication.address,
            payloadLength,
            encodedAdapterParams
        );
        const oracleFee = await oracle.getFee(
            chainId,
            outboundProofType2,
            defaultBlockConfirmations,
            userApplication.address
        );
        const treasuryProtocolNativeFee = await treasury.getFees(payInZRO, relayerFee, oracleFee);
        const oracleQuotedFee = await oracle.getFee(
            chainId,
            outboundProofType2,
            defaultBlockConfirmations,
            userApplication.address
        );
        const relayerQuotedFee = await relayer.getFee(
            chainId,
            outboundProofType2,
            userApplication.address,
            payloadLength,
            txParams
        );

        // Verify both the endpoint and ultraLightNode return the same estimate
        const { nativeFee: nativeFeeEstimate } = await ultraLightNode.estimateFees(
            chainId,
            userApplication.address,
            payload,
            payInZRO,
            txParams
        );
        const { nativeFee: nativeFeeEstimateV2 } = await lzEndpoint.estimateFees(
            chainId,
            userApplication.address,
            payload,
            payInZRO,
            txParams
        );
        expect(nativeFeeEstimate).to.equal(nativeFeeEstimateV2);

        // Verify balances before send
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(0);
        expect(await ultraLightNode.treasuryZROFees()).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(treasury.address)).to.equal(0);

        let nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, txParams],
            nativeFeeEstimate
        );

        // Verify balances after send
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(oracleQuotedFee);
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(relayerQuotedFee);
        expect(await ultraLightNode.treasuryZROFees()).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(treasury.address)).to.equal(treasuryProtocolNativeFee);

        nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, txParams],
            nativeFeeEstimate
        );

        // Verify balances after sending a second time, should have doubled the fees
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(oracleQuotedFee.mul(2));
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(relayerQuotedFee.mul(2));
        expect(await ultraLightNode.treasuryZROFees()).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(treasury.address)).to.equal(treasuryProtocolNativeFee.mul(2));
    });

    it('send() - no protocol fee enabled', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x666666'; // is 3 bytes
        const refundAddress = userApplication.address;
        const zroPaymentAddress = ZERO_ADDRESS;

        // set fees to 0
        await oracle.setPrice(chainId, outboundProofType2, 0);
        await relayer.setDstPrice(chainId, 0, 0);
        await relayer.setDstConfig(chainId, outboundProofType2, 0, 0, 0);
        await treasury.setZroFee(0);
        await treasury.setNativeBP(0);

        // verify balances before send
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(0);

        let nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, txParams]
        );

        // verify balances after send
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(0);
    });

    it('send() - estimateFee reverts if we remove 1', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x6666'; // is 3 bytes
        const refundAddress = userApplication.address;
        const zroPaymentAddress = userApplication.address;
        const payInZRO = true;

        // enable zro fee
        await treasury.setZroEnabled(true);
        await treasury.setZroFee(69);

        const { nativeFee: nativeFeeEstimate } = await ultraLightNode.estimateFees(
            chainId,
            zroPaymentAddress,
            payload,
            payInZRO,
            txParams
        );

        // should fail even if - 1
        let nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await expect(
            callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [
                    userApplication.address,
                    nonce,
                    chainId,
                    path,
                    payload,
                    refundAddress,
                    userApplication.address,
                    txParams,
                ],
                nativeFeeEstimate - 1
            )
        ).to.be.revertedWith('LayerZero: not enough native for fees');

        // should succeed
        await expect(
            callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [
                    userApplication.address,
                    nonce,
                    chainId,
                    path,
                    payload,
                    refundAddress,
                    userApplication.address,
                    txParams,
                ],
                nativeFeeEstimate
            )
        ).to.not.be.reverted;
    });

    it('send() - paying with ZRO, lzFee enabled', async function () {
        const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
        const payload = '0x6666'; // is 3 bytes
        const payloadLength = 3;
        const refundAddress = userApplication.address;
        const zroPaymentAddress = userApplication.address;
        const payInZRO = true;
        const encodedAdapterParams = encodePackedParams(
            adapterParams[outboundProofType2].types,
            adapterParams[outboundProofType2].values
        );

        // enable zro fee
        await treasury.setZroEnabled(true);
        await treasury.setZroFee(69);

        // expected fees to be increased/reduced by
        const relayerFee = await relayer.getFee(
            chainId,
            outboundProofType2,
            userApplication.address,
            payloadLength,
            encodedAdapterParams
        );
        const oracleFee = await oracle.getFee(
            chainId,
            outboundProofType2,
            defaultBlockConfirmations,
            userApplication.address
        );
        const treasuryProtocolZROFee = await treasury.getFees(payInZRO, relayerFee, oracleFee);
        const oracleQuotedFee = await oracle.getFee(
            chainId,
            outboundProofType2,
            defaultBlockConfirmations,
            userApplication.address
        );
        const relayerQuotedFee = await relayer.getFee(
            chainId,
            outboundProofType2,
            userApplication.address,
            payloadLength,
            txParams
        );

        const { nativeFee: nativeFeeEstimate } = await ultraLightNode.estimateFees(
            chainId,
            zroPaymentAddress,
            payload,
            payInZRO,
            txParams
        );

        // verify balances before send
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(0);
        expect(await ultraLightNode.treasuryZROFees()).to.equal(0);
        expect(await ultraLightNode.accruedNativeFee(treasury.address)).to.equal(0);

        let nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, userApplication.address, txParams],
            nativeFeeEstimate
        );

        // verify balances after send
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(oracleQuotedFee);
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(relayerQuotedFee);
        expect(await ultraLightNode.treasuryZROFees()).to.equal(treasuryProtocolZROFee);
        expect(await ultraLightNode.accruedNativeFee(treasury.address)).to.equal(0);

        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(oracleQuotedFee);
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(relayerQuotedFee);

        nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
        await callAsContract(
            ultraLightNode,
            lzEndpoint.address,
            'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
            [userApplication.address, nonce, chainId, path, payload, refundAddress, userApplication.address, txParams],
            nativeFeeEstimate
        );

        // verify balances after sending a second time, should have doubled the fees
        expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(oracleQuotedFee.mul(2));
        expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(relayerQuotedFee.mul(2));
        expect(await ultraLightNode.treasuryZROFees()).to.equal(treasuryProtocolZROFee.mul(2));
        expect(await ultraLightNode.accruedNativeFee(treasury.address)).to.equal(0);
    });

    it("send() - reverts with 'LayerZero: Only endpoint", async function () {
        await expect(
            ultraLightNode['send(address,uint64,uint16,bytes,bytes,address,address,bytes)'](
                ZERO_ADDRESS,
                0,
                0,
                '0x',
                '0x',
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                '0x'
            )
        ).to.be.revertedWith('LayerZero: only endpoint');
    });

    it('validateTransactionProof() - reverts with invalid relayer', async function () {
        const txnProof = '0x0000000000000000000000000000000000000000000000000000000000012345';
        await expect(
            ultraLightNode.validateTransactionProof(
                chainId,
                userApplication.address,
                0,
                emptyBytes32,
                emptyBytes32,
                txnProof
            )
        ).to.be.revertedWith('LayerZero: invalid relayer');
    });

    it('validateTransactionProof() - reverts with not enough block confirmations', async function () {
        // block confirmations very high so it fails
        await setInboundBlockConfirmations(ultraLightNode, lzEndpoint, userApplication, 345, chainId);

        const txnProof = '0x0000000000000000000000000000000000000000000000000000000000012345';
        await expect(
            callAsContract(
                ultraLightNode,
                relayer.address,
                'validateTransactionProof(uint16,address,uint256,bytes32,bytes32,bytes)',
                [chainId, userApplication.address, 0, emptyBytes32, emptyBytes32, txnProof]
            )
        ).to.be.revertedWith('LayerZero: not enough block confirmations');
    });

    describe('withdraw fees:', async function () {
        beforeEach(async function () {
            const path = ethers.constants.AddressZero.concat(userApplication.address.slice(2)); // remove 0x
            const payload = '0x666666'; // is 3 bytes
            const refundAddress = userApplication.address;
            const zroPaymentAddress = userApplication.address;
            const payInZRO = true;

            // enable zro fee
            await treasury.setZroEnabled(true);
            await treasury.setZroFee(69);

            let { nativeFee: _fee1 } = await ultraLightNode.estimateFees(
                chainId,
                zroPaymentAddress,
                payload,
                payInZRO,
                txParams
            );

            let nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
            await callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [userApplication.address, nonce, chainId, path, payload, refundAddress, zroPaymentAddress, txParams],
                _fee1
            );

            let { nativeFee: _fee2 } = await ultraLightNode.estimateFees(
                chainId,
                zroPaymentAddress,
                payload,
                !payInZRO,
                txParams
            );

            nonce = await lzEndpoint.outboundNonce(chainId, userApplication.address);
            await callAsContract(
                ultraLightNode,
                lzEndpoint.address,
                'send(address,uint64,uint16,bytes,bytes,address,address,bytes)',
                [userApplication.address, nonce, chainId, path, payload, refundAddress, ZERO_ADDRESS, txParams],
                _fee2
            );
        });

        it('withdrawZRO() - reverts with only treasury', async function () {
            await expect(ultraLightNode.connect(badUser1).withdrawZRO(ZERO_ADDRESS, 1)).to.be.revertedWith(
                'LayerZero: only treasury'
            );
        });

        it('withdrawZRO() - treasury', async function () {
            expect((await ultraLightNode.treasuryZROFees()).toNumber()).to.be.greaterThan(0);

            const balanceBefore = await lzToken.balanceOf(user1.address);
            const diff = await ultraLightNode.treasuryZROFees();
            await expect(
                callAsContract(ultraLightNode, treasury.address, 'withdrawZRO(address,uint256)', [user1.address, diff])
            )
                .to.emit(ultraLightNode, 'WithdrawZRO')
                .withArgs(treasury.address, user1.address, diff);

            expect((await lzToken.balanceOf(user1.address)).sub(balanceBefore)).to.equal(diff);
            expect(await ultraLightNode.treasuryZROFees()).to.equal(0);

            // reverts when nothing to withdraw
            await expect(
                callAsContract(ultraLightNode, treasury.address, 'withdrawZRO(address,uint256)', [user1.address, 1])
            ).revertedWithPanic(0x11);
        });

        it('withdrawNative() - reverts if to address cant accept ether', async function () {
            await expect(
                callAsContract(ultraLightNode, oracle.address, 'withdrawNative(address,uint256)', [
                    lzToken.address, // does not accept direct ether transfer
                    1,
                ])
            ).to.revertedWith('LayerZero: withdraw failed');
        });

        it('withdrawNative() - reverts if to address is 0x0', async function () {
            await expect(
                callAsContract(ultraLightNode, oracle.address, 'withdrawNative(address,uint256)', [ZERO_ADDRESS, 1])
            ).to.revertedWith('LayerZero: _to cannot be zero address');
        });

        it('withdrawNative() - oracle', async function () {
            expect((await ultraLightNode.accruedNativeFee(oracle.address)).toNumber()).to.be.greaterThan(0);

            const balanceBefore = await getBalance(user1.address);
            const diff = await ultraLightNode.accruedNativeFee(oracle.address);
            await expect(
                callAsContract(ultraLightNode, oracle.address, 'withdrawNative(address,uint256)', [user1.address, diff])
            )
                .to.emit(ultraLightNode, 'WithdrawNative')
                .withArgs(oracle.address, user1.address, diff);

            expect((await getBalance(user1.address)).sub(balanceBefore)).to.equal(diff);
            expect(await ultraLightNode.accruedNativeFee(oracle.address)).to.equal(0);

            // reverts when nothing to withdraw
            await expect(
                callAsContract(ultraLightNode, oracle.address, 'withdrawNative(address,uint256)', [user1.address, 1])
            ).revertedWithPanic(0x11);
        });

        it.skip('withdrawNative() - relayer', async function () {
            expect((await ultraLightNode.accruedNativeFee(relayer.address)).toNumber()).to.be.greaterThan(0);

            const balanceBefore = await getBalance(user1.address);
            const diff = await ultraLightNode.accruedNativeFee(relayer.address);
            await expect(
                callAsContract(ultraLightNode, relayer.address, 'withdrawNative(address,uint256)', [
                    user1.address,
                    diff,
                ])
            )
                .to.emit(ultraLightNode, 'WithdrawNative')
                .withArgs(relayer.address, user1.address, diff);

            expect((await getBalance(user1.address)).sub(balanceBefore)).to.equal(diff);
            expect(await ultraLightNode.accruedNativeFee(relayer.address)).to.equal(0);

            // reverts when nothing to withdraw
            await expect(
                callAsContract(ultraLightNode, relayer.address, 'withdrawNative(address,uint256)', [user1.address, 1])
            ).revertedWith('panic code 0x11');
        });
    });

    it('updateHash() - reverts if same data (srcChainId, oracle, blockHash) is set with LTE confirmations', async function () {
        const blockHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const _data = '0x0000000000000000000000000000000000000000000000000000000000012345';
        const confirmations = 2;

        await oracle.setApprovedAddress(approvedOracle.address, true); // approve the oracle mock for this test
        await ultraLightNode.connect(approvedOracle).updateHash(chainId, blockHash, confirmations, _data); // set it the initial time

        // try setting the same oracle/srcChaindId/blockHash/confirmations again
        await expect(
            ultraLightNode.connect(approvedOracle).updateHash(chainId, blockHash, confirmations, _data)
        ).to.be.revertedWith('LayerZero: oracle data can only update if it has more confirmations');
    });

    it('updateHash() - can continue being set if confirmations is increased', async function () {
        const blockHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const _data = '0x0000000000000000000000000000000000000000000000000000000000012345';
        let confirmations = 2;

        await ultraLightNode.connect(approvedOracle).updateHash(chainId, blockHash, confirmations, _data);

        let storedConfirmations = await ultraLightNode.hashLookup(approvedOracle.address, chainId, blockHash, _data);
        expect(storedConfirmations).to.equal(confirmations);

        confirmations += 1;

        await ultraLightNode.connect(approvedOracle).updateHash(chainId, blockHash, confirmations, _data);

        storedConfirmations = await ultraLightNode.hashLookup(approvedOracle.address, chainId, blockHash, _data);
        expect(storedConfirmations).to.equal(confirmations);
    });

    it('setChainAddressSize() - reverts as non owner', async function () {
        await expect(ultraLightNode.connect(badUser1).setChainAddressSize(1, 1)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('setChainAddressSize() - reverts when called multiple times', async function () {
        const size = 567;
        const _chainId = chainId + 1;
        await expect(ultraLightNode.setChainAddressSize(_chainId, size))
            .to.emit(ultraLightNode, 'SetChainAddressSize')
            .withArgs(_chainId, size);
        await expect(ultraLightNode.setChainAddressSize(_chainId, size + 1)).to.revertedWith(
            'LayerZero: remote chain address size already set'
        );
        expect(await ultraLightNode.chainAddressSizeMap(_chainId)).to.equal(size); // size wasnt changed on the revert call
    });

    it('setChainAddressSize() - emit event / set', async function () {
        const size = 567;
        const _chainId = chainId + 1;
        await expect(ultraLightNode.setChainAddressSize(_chainId, size))
            .to.emit(ultraLightNode, 'SetChainAddressSize')
            .withArgs(_chainId, size);
        expect(await ultraLightNode.chainAddressSizeMap(_chainId)).to.equal(size);
    });

    it('setRemoteUln() - reverts as 0x0', async function () {
        const zeroBytes32 = ethers.utils.hexZeroPad(user1.address, 32);
        await ultraLightNode.setRemoteUln(123, zeroBytes32);
        await expect(ultraLightNode.setRemoteUln(123, zeroBytes32)).to.be.revertedWith(
            'LayerZero: remote uln already set'
        );
    });

    it('addInboundProofLibraryForChain() - reverts as 0x0', async function () {
        await expect(ultraLightNode.addInboundProofLibraryForChain(123, ZERO_ADDRESS)).to.be.revertedWith(
            'LayerZero: library cannot be zero address'
        );
    });

    it('addInboundProofLibraryForChain() - reverts as non owner', async function () {
        await expect(
            ultraLightNode.connect(badUser1).addInboundProofLibraryForChain(123, fakeContract.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('addInboundProofLibraryForChain() emit event / set', async function () {
        const nextLibVersion = await ultraLightNode.maxInboundProofLibrary(chainId);
        await expect(ultraLightNode.addInboundProofLibraryForChain(chainId, user1.address))
            .to.emit(ultraLightNode, 'AddInboundProofLibraryForChain')
            .withArgs(chainId, user1.address);
        expect(await ultraLightNode.inboundProofLibrary(chainId, nextLibVersion + 1)).to.equal(user1.address);
        await expect(ultraLightNode.addInboundProofLibraryForChain(chainId, fakeContract.address))
            .to.emit(ultraLightNode, 'AddInboundProofLibraryForChain')
            .withArgs(chainId, fakeContract.address);
        expect(await ultraLightNode.inboundProofLibrary(chainId, nextLibVersion + 2)).to.equal(fakeContract.address);
    });

    it('maxInboundProofLibrary() - defaults to 0', async function () {
        expect(await ultraLightNode.maxInboundProofLibrary(234)).to.equal(0); // random chain id
    });

    it('maxInboundProofLibrary() - incremented after library added', async function () {
        await ultraLightNode.addInboundProofLibraryForChain(chainId, user1.address);
        expect(await ultraLightNode.maxInboundProofLibrary(chainId)).to.equal(2); // library already exists so its now 2
    });
});

describe('Max Library Version:', function () {
    let chainId = 1;
    let chainIds = [chainId];
    let user1,
        fakeContract,
        badUser1,
        approvedOracle,
        userApplication,
        oracle,
        relayer,
        ultraLightNode,
        lzEndpoint,
        treasury,
        lzToken,
        relayerWithdraw;
    let { outboundProofType2, zroFee } = VARS;
    let v2 = true;

    before(async function () {
        ({ user1, user2: approvedOracle, badUser1, fakeContract } = await getAddr(ethers));
    });

    beforeEach(async function () {
        await deployments.fixture(['test']);

        let endpoints = await generateEndpoints(chainIds, true); // needs semicolon or object destructuring assignment breaks rip
        ({
            oracle,
            relayer,
            lzEndpoint,
            ultraLightNode,
            treasury,
            lzToken,
            relayerWithdraw,
            counterMock: userApplication,
        } = (
            await wireEndpoints(
                [await generateVersion(endpoints[0], chainIds, outboundProofType2, 1, false, v2, true)],
                true,
                v2
            )
        )[0]);

        // UA has ZRO to spend
        await lzToken.transfer(userApplication.address, zroFee * 2);
        // give ultraLightNode allowance to transfer ZRO on the UA behalf
        await callAsContract(lzToken, userApplication.address, 'approve(address,uint256)', [
            ultraLightNode.address,
            zroFee * 2,
        ]);
    });

    it('addInboundProofLibraryForChain() - reverts when max uint16 is reached', async function () {
        const uln = await deployNew('UltraLightNodeV2', [lzEndpoint.address, fakeContract.address, 1]);
        chainId = 10; // a specific chainId

        // increase the max validation library to 3
        await uln.addInboundProofLibraryForChain(chainId, user1.address);
        await uln.addInboundProofLibraryForChain(chainId, user1.address);
        await uln.addInboundProofLibraryForChain(chainId, user1.address);

        // https://docs.soliditylang.org/en/v0.8.11/internals/layout_in_storage.html
        // eg. mapping(uint16 => uint16) public maxInboundProofLibrary;
        // hash the concated values to find the storagePointer
        const keyAndIndexMapPointerHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(['uint16', 'uint16'], [chainId, 10])
        );

        // retrieve the value in storage via the storage pointer
        let numInboundProofLibrary = await network.provider.send('eth_getStorageAt', [
            uln.address,
            keyAndIndexMapPointerHash,
        ]);

        // check the value is as expected
        expect(numInboundProofLibrary).to.equal('0x0000000000000000000000000000000000000000000000000000000000000003');
        expect(await uln.maxInboundProofLibrary(chainId)).to.equal(3);

        // max number of libraries eg. max uint16 => 65535 => 0xffff
        const maxNumInboundLibrary = '0x000000000000000000000000000000000000000000000000000000000000ffff';

        // set the value in storage
        await network.provider.send('hardhat_setStorageAt', [
            uln.address,
            keyAndIndexMapPointerHash,
            maxNumInboundLibrary,
        ]);

        // retrieve the value in storage
        numInboundProofLibrary = await network.provider.send('eth_getStorageAt', [
            uln.address,
            keyAndIndexMapPointerHash,
        ]);

        // check the value is as expected
        expect(numInboundProofLibrary).to.equal(maxNumInboundLibrary);
        expect(await uln.maxInboundProofLibrary(chainId)).to.equal(65535);

        // reverts as since we are at the max uint16 amount
        await expect(uln.addInboundProofLibraryForChain(chainId, user1.address)).to.revertedWith(
            'LayerZero: can not add new library'
        );
    });
});
