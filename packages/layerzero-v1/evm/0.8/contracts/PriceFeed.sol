// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "./interfaces/ILayerZeroPriceFeed.sol";

contract PriceFeed is ILayerZeroPriceFeed, OwnableUpgradeable, Proxied {
    uint128 public PRICE_RATIO_DENOMINATOR;

    // sets pricing
    mapping(address => bool) public priceUpdater;

    // [_chainId]
    mapping(uint16 => Price) public defaultModelPrice;
    ArbitrumPriceExt public arbitrumPriceExt;

    uint128 public override nativeTokenPriceUSD; // uses PRICE_RATIO_DENOMINATOR

    // upgrade: arbitrum compression - percentage of callDataSize after brotli compression
    uint128 public ARBITRUM_COMPRESSION_PERCENT;

    // ============================ Constructor ===================================

    function initialize(address _priceUpdater) public proxied initializer {
        __Ownable_init();
        priceUpdater[_priceUpdater] = true;
        PRICE_RATIO_DENOMINATOR = 1e10;
        ARBITRUM_COMPRESSION_PERCENT = 47;
    }

    function onUpgrade() public proxied {
        PRICE_RATIO_DENOMINATOR = 1e10;
        ARBITRUM_COMPRESSION_PERCENT = 47;
    }

    // ============================ Modifier ======================================

    // owner is always approved
    modifier onlyPriceUpdater() {
        if (owner() != msg.sender) {
            require(priceUpdater[msg.sender], "PriceFeed: not price updater");
        }
        _;
    }

    // ============================ OnlyOwner =====================================

    function setPriceUpdater(address _addr, bool _active) external onlyOwner {
        priceUpdater[_addr] = _active;
    }

    function setPriceRatioDenominator(uint128 _denominator) external onlyOwner {
        PRICE_RATIO_DENOMINATOR = _denominator;
    }

    function setArbitrumCompressionPercent(uint128 _compressionPercent) external onlyOwner {
        ARBITRUM_COMPRESSION_PERCENT = _compressionPercent;
    }

    // ============================ OnlyPriceUpdater =====================================

    function setPrice(UpdatePrice[] calldata _price) external onlyPriceUpdater {
        for (uint i = 0; i < _price.length; i++) {
            UpdatePrice calldata _update = _price[i];
            _setPrice(_update.chainId, _update.price);
        }
    }

    function setPriceForArbitrum(UpdatePriceExt[] calldata _price) external onlyPriceUpdater {
        for (uint i = 0; i < _price.length; i++) {
            UpdatePriceExt calldata _update = _price[i];

            _setPrice(_update.chainId, _update.price);

            uint64 gasPerL2Tx = _update.extend.gasPerL2Tx;
            uint32 gasPerL1CalldataByte = _update.extend.gasPerL1CallDataByte;

            arbitrumPriceExt.gasPerL2Tx = gasPerL2Tx;
            arbitrumPriceExt.gasPerL1CallDataByte = gasPerL1CalldataByte;
        }
    }

    function setNativeTokenPriceUSD(uint128 _nativeTokenPriceUSD) external onlyPriceUpdater {
        nativeTokenPriceUSD = _nativeTokenPriceUSD;
    }

    // ============================ Internal ==========================================
    function _setPrice(uint16 chainId, Price memory _price) internal {
        uint128 priceRatio = _price.priceRatio;
        uint64 gasPriceInUnit = _price.gasPriceInUnit;
        uint32 gasPerByte = _price.gasPerByte;
        defaultModelPrice[chainId] = Price(priceRatio, gasPriceInUnit, gasPerByte);
    }

    // For optimism l1 gas price lookup
    function _getL1LookupId(uint16 _l2ChainId) internal pure returns (uint16) {
        if (_l2ChainId == 111) {
            return 101;
        } else if (_l2ChainId == 10132) {
            return 10121; // ethereum-goerli
        } else if (_l2ChainId == 20132) {
            return 20121; // ethereum-goerli
        } else {
            revert("PriceFeed: unknown l2 chain id");
        }
    }

    // ============================ View ==========================================

    function getPrice(uint16 _dstChainId) external view override returns (Price memory price) {
        price = defaultModelPrice[_dstChainId];
    }

    function getPriceRatioDenominator() external view override returns (uint128) {
        return PRICE_RATIO_DENOMINATOR;
    }

    function estimateFeeByChain(
        uint16 _dstChainId,
        uint _callDataSize,
        uint _gas
    ) external view override returns (uint fee, uint128 priceRatio) {
        if (_dstChainId == 110 || _dstChainId == 10143 || _dstChainId == 20143) {
            return estimateFeeWithArbitrumModel(_dstChainId, _callDataSize, _gas);
        } else if (_dstChainId == 111 || _dstChainId == 10132 || _dstChainId == 20132) {
            return estimateFeeWithOptimismModel(_dstChainId, _callDataSize, _gas);
        } else {
            return estimateFeeWithDefaultModel(_dstChainId, _callDataSize, _gas);
        }
    }

    function estimateFeeWithDefaultModel(
        uint16 _dstChainId,
        uint _callDataSize,
        uint _gas
    ) public view returns (uint fee, uint128 priceRatio) {
        Price storage remotePrice = defaultModelPrice[_dstChainId];

        // assuming the _gas includes (1) the 21,000 overhead and (2) not the calldata gas
        uint gasForCallData = _callDataSize * remotePrice.gasPerByte;
        uint remoteFee = (gasForCallData + _gas) * remotePrice.gasPriceInUnit;
        return ((remoteFee * remotePrice.priceRatio) / PRICE_RATIO_DENOMINATOR, remotePrice.priceRatio);
    }

    function estimateFeeWithOptimismModel(
        uint16 _dstChainId,
        uint _callDataSize,
        uint _gas
    ) public view returns (uint fee, uint128 priceRatio) {
        uint16 ethereumId = _getL1LookupId(_dstChainId);

        // L1 fee
        Price storage ethereumPrice = defaultModelPrice[ethereumId];
        uint gasForL1CallData = (_callDataSize * ethereumPrice.gasPerByte) + 3188; // 2100 + 68 * 16
        uint l1Fee = gasForL1CallData * ethereumPrice.gasPriceInUnit;

        // L2 fee
        Price storage optimismPrice = defaultModelPrice[_dstChainId];
        uint gasForL2CallData = _callDataSize * optimismPrice.gasPerByte;
        uint l2Fee = (gasForL2CallData + _gas) * optimismPrice.gasPriceInUnit;

        uint l1FeeInSrcPrice = (l1Fee * ethereumPrice.priceRatio) / PRICE_RATIO_DENOMINATOR;
        uint l2FeeInSrcPrice = (l2Fee * optimismPrice.priceRatio) / PRICE_RATIO_DENOMINATOR;
        uint gasFee = l1FeeInSrcPrice + l2FeeInSrcPrice;
        return (gasFee, optimismPrice.priceRatio);
    }

    function estimateFeeWithArbitrumModel(
        uint16 _dstChainId,
        uint _callDataSize,
        uint _gas
    ) public view returns (uint fee, uint128 priceRatio) {
        Price storage arbitrumPrice = defaultModelPrice[_dstChainId];

        // L1 fee
        uint gasForL1CallData = ((_callDataSize * ARBITRUM_COMPRESSION_PERCENT) / 100) *
            arbitrumPriceExt.gasPerL1CallDataByte;
        // L2 Fee
        uint gasForL2CallData = _callDataSize * arbitrumPrice.gasPerByte;
        uint gasFee = (_gas + arbitrumPriceExt.gasPerL2Tx + gasForL1CallData + gasForL2CallData) *
            arbitrumPrice.gasPriceInUnit;

        return ((gasFee * arbitrumPrice.priceRatio) / PRICE_RATIO_DENOMINATOR, arbitrumPrice.priceRatio);
    }
}
