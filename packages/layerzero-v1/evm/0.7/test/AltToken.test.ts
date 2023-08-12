import { expect } from 'chai'

const hre = require('hardhat')

const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'

const { getAddr } = require('../utils/helpers')

describe('AltToken', function () {
    let endpoint, ua, uln, relayer, treasury, oracle, feeToken, feeHandler, priceFeed
    const adapterParams = hre.ethers.utils.solidityPack(['uint16', 'uint256'], [1, 200000])
    const dstChainId = 1
    const proofType = 1
    const payload = '0x1234'
    let owner, receiver
    let fee

    before(async function () {
        const signers = await hre.ethers.getSigners()
        const { deployer, layerzeroDeployer, relayerDeployer, proxyAdminDeployer } = await getAddr(hre.ethers)
        owner = layerzeroDeployer
        receiver = signers[1]

        await hre.deployments.fixture(['alt-token'])
        uln = (await hre.ethers.getContract('UltraLightNodeV2AltToken')).connect(layerzeroDeployer)
        relayer = (await hre.ethers.getContract('RelayerV2')).connect(relayerDeployer)
        treasury = (await hre.ethers.getContract('TreasuryV2')).connect(layerzeroDeployer)
        feeHandler = (await hre.ethers.getContract('FeeHandler')).connect(layerzeroDeployer)
        endpoint = (await hre.ethers.getContract('Endpoint')).connect(layerzeroDeployer)
        feeToken = (await hre.ethers.getContract('Token')).connect(layerzeroDeployer)
        const PriceFeed = await hre.ethers.getContractFactory('PriceFeedV2Mock')
        priceFeed = await PriceFeed.connect(relayerDeployer).deploy()
        await priceFeed.initialize(deployer.address)
        await relayer.setPriceFeed(priceFeed.address)

        const Oracle = await hre.ethers.getContractFactory('LayerZeroOracleMockV2')
        oracle = await Oracle.connect(layerzeroDeployer).deploy()
        const UA = await hre.ethers.getContractFactory('AltTokenUA')
        ua = await UA.connect(layerzeroDeployer).deploy(endpoint.address, feeToken.address, feeHandler.address)
        ua = ua.connect(layerzeroDeployer)

        await endpoint.newVersion(uln.address)
        await endpoint.setDefaultSendVersion(1)

        await uln.addInboundProofLibraryForChain(dstChainId, ADDRESS_ONE)
        await uln.enableSupportedOutboundProof(dstChainId, 1)
        await uln.setDefaultConfigForChainId(dstChainId, 1, 1, relayer.address, proofType, 1, oracle.address)
        await uln.setTreasury(treasury.address)
        await uln.setDefaultAdapterParamsForChainId(dstChainId, proofType, adapterParams)
        await uln.setChainAddressSize(dstChainId, 20)
        await uln.setRemoteUln(dstChainId, hre.ethers.utils.defaultAbiCoder.encode(['address'], [uln.address]))

        await feeHandler.connect(layerzeroDeployer).setFeeToken(feeToken.address)

        await priceFeed.setPrice([[dstChainId, ['100000000000000000000', hre.ethers.utils.parseUnits('14', 9), 1]]])

        await relayer.setDstConfig(dstChainId, proofType, hre.ethers.utils.parseEther('1'), '200000', '16')

        await treasury.setFeeEnabled(true)
        await treasury.setNativeBP(1000)

        fee = await uln.estimateFees(dstChainId, ua.address, payload, false, '0x')

        await feeToken.approve(ua.address, hre.ethers.constants.MaxUint256)
    })

    // approved in deployments file
    it.skip('non approved uln cannot send to feeHandler', async function () {
        await expect(ua.send(dstChainId, ua.address, payload, '0x', fee.nativeFee)).to.be.revertedWith(
            'FeeHandler: not approved'
        )
    })

    it('fees are correctly credited', async function () {
        // approved in deployments file
        // await feeHandler.approve(uln.address);

        //feeHandler balance before transaction should be empty
        expect(await feeToken.balanceOf(feeHandler.address)).to.equal(0)
        const senderBalanceBefore = await feeToken.balanceOf(owner.address)
        const relayerFeeBefore = await feeToken.balanceOf(relayer.address)
        const treasuryFeeBefore = await feeToken.balanceOf(treasury.address)

        await ua.send(dstChainId, ua.address, payload, '0x', fee.nativeFee.add(1))

        //sender only spent fee.nativeFee, additional 1 dollar refunded
        const senderBalanceAfter = await feeToken.balanceOf(owner.address)
        expect(senderBalanceBefore.sub(senderBalanceAfter)).to.equal(fee.nativeFee)

        //relayer received fee.relayerFee
        const relayerFeeAfter = await feeToken.balanceOf(relayer.address)
        expect(relayerFeeAfter.sub(relayerFeeBefore)).to.equal(6731188800000000)

        //treasury received fee.treasuryFee
        const treasuryFeeAfter = await feeToken.balanceOf(treasury.address)
        expect(treasuryFeeAfter.sub(treasuryFeeBefore)).to.equal(673118880000000)

        //feeHandler balance after transaction should be empty
        expect(await feeToken.balanceOf(feeHandler.address)).to.equal(0)
    })

    it('can withdraw funds from relayer contract', async function () {
        const balanceBefore = await feeToken.balanceOf(receiver.address)
        await relayer.withdrawToken(feeToken.address, receiver.address, 6731188800000000)
        const balanceAfter = await feeToken.balanceOf(receiver.address)
        expect(balanceAfter.sub(balanceBefore)).to.equal(6731188800000000)
    })

    it('can withdraw funds from treasury contract', async function () {
        const balanceBefore = await feeToken.balanceOf(receiver.address)
        await treasury.withdrawToken(feeToken.address, receiver.address, 673118880000000)
        const balanceAfter = await feeToken.balanceOf(receiver.address)
        expect(balanceAfter.sub(balanceBefore)).to.equal(673118880000000)
    })
})
