// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";

import "../interfaces/ILayerZeroOracleV2.sol";
import "../interfaces/ILayerZeroUltraLightNodeV2.sol";
import "../interfaces/ILayerZeroPriceFeed.sol";

contract OracleV2 is ILayerZeroOracleV2, ReentrancyGuard, OwnableUpgradeable, Proxied {
    using SafeERC20 for IERC20;

    ILayerZeroUltraLightNodeV2 public uln;
    uint16 public threshold;
    uint16 public committeeSize;

    struct DstPrice {
        uint128 dstPriceRatio; // 10^10
        uint128 dstGasPriceInWei;
    }

    struct ProposedBlock {
        uint16 approvalCount;
        bool submitted;
        mapping(address => bool) approvedBy;
    }

    mapping(address => bool) public admins; // sets pricing
    mapping(address => bool) public validators; // submit and validates lookup hash and confirmations
    mapping(address => bool) public whitelist; // to call notify oracle

    mapping(uint16 => DstPrice) public dstPriceLookupOld;
    // [_chainId][_outboundProofType]
    mapping(uint16 => mapping(uint16 => uint64)) public dstGasLookup;

    //proposalLookup[_srcChainId][_lookupHash][_confirmations][_data];
    mapping(uint16 => mapping(bytes32 => mapping(uint => mapping(bytes32 => ProposedBlock)))) public proposalLookup; //chainId => lookupHash => confirmations

    event AdminUpdated(address _addr, bool _active);
    event ValidatorUpdated(address _addr, bool _active);
    event WhitelistUpdated(address _addr, bool _active);
    event ThresholdUpdated(uint16 _threshold);
    event ValidatedBlock(
        address indexed validator,
        uint16 srcChainId,
        bytes32 lookupHash,
        uint confirmations,
        bytes32 data
    );
    event AssignJob(
        uint16 _dstChainId,
        uint16 _outboundProofType,
        uint _outboundBlockConfirmations,
        address _userApplication,
        uint _fee
    );
    event SetDstPrice(uint16 _chainId, uint128 _dstPriceRatio, uint128 _dstGasPriceInWei);
    event SetDstGas(uint16 _chainId, uint16 _outboundProofType, uint64 _gas);

    // Update for Price Feed
    ILayerZeroPriceFeed public priceFeed;
    // multiplier
    uint128 public multiplierBps;

    // PriceFeedContract Upgrade
    uint16 public validateBlockBytes; // funcSigHash + params -> 4  + (32 * 4)

    // MultiSigOracle Upgrade
    event UpdateAdmin(address _addr, bool _active);
    event SetUln(address _addr, bool _active);
    event Execute(address _target, bytes32 _callDataHash, bool _success, bytes _data);
    event UpdatePriceFeed(address _priceFeed);
    event UpdatePriceMultiplierBps(uint128 _multiplierBps);
    mapping(address => bool) public ulns; // to call assignJob
    mapping(bytes32 => bool) public usedHashes;
    uint16 public executeFixedBytes; // encoded: funcSigHash + params -> 4  + (32 * 2)
    uint16 public signatureRawBytes; // not encoded
    // callData(updateHash) = 132 (4 + 32 * 4), padded to 32 = 160 and encoded as bytes with an 64 byte overhead = 224
    uint16 public updateHashBytes;
    bool public useMso;

    // MultiSig
    mapping(address => bool) public signers;
    uint64 public signerSize;
    uint64 public quorum;

    event UpdateSigner(address _signer, bool _active);
    event UpdateQuorum(uint64 _quorum);

    // AccessControl
    mapping(address => bool) public allowlist;
    mapping(address => bool) public denylist;
    uint64 public allowlistSize;

    event UpdateAllowlist(address _addr, bool _active);
    event UpdateDenylist(address _addr, bool _active);

    // ============================ Constructor ====================================

    function initialize(address _uln, address _priceFeed) public proxied initializer {
        __Ownable_init();
        uln = ILayerZeroUltraLightNodeV2(_uln);
        multiplierBps = 12000;
        priceFeed = ILayerZeroPriceFeed(_priceFeed);
        validateBlockBytes = 132;

        // should not ever deploy a new one
        revert("Oracle: upgrade only");
    }

    function onUpgrade(
        address _uln,
        address _priceFeed,
        address[] memory _signers,
        uint64 _quorum,
        address[] memory _admins
    ) public proxied {
        multiplierBps = 12000;
        priceFeed = ILayerZeroPriceFeed(_priceFeed);
        validateBlockBytes = 132;

        // MultiSigOracle upgrade
        // Constructor of MultiSig
        require(_signers.length >= _quorum && _quorum > 0, "MultiSig: signers too few ");
        // MultSigOracle fixed bytes for quoting
        executeFixedBytes = 68;
        signatureRawBytes = 65;
        updateHashBytes = 224;

        address lastSigner = address(0);
        for (uint i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer > lastSigner, "MultiSig: signers not sorted"); // to ensure no duplicates
            signers[signer] = true;
            lastSigner = signer;
        }
        signerSize = uint64(_signers.length);
        quorum = _quorum;

        // Constructor of MultiSigOracle
        ulns[_uln] = true;
        for (uint i = 0; i < _admins.length; i++) {
            admins[_admins[i]] = true;
        }

        useMso = true;
    }

    // ============================ Modifier ====================================

    // owner is always approved
    modifier onlyAdmin() {
        if (owner() != msg.sender) {
            require(admins[msg.sender], "Oracle: not admin ");
        }
        _;
    }

    modifier onlyValidator() {
        require(validators[msg.sender], "Oracle: not validator");
        _;
    }

    // uln is always approved
    modifier onlyWhitelist() {
        if (address(uln) != msg.sender) {
            require(whitelist[msg.sender], "Oracle: not in whitelist");
        }
        _;
    }

    modifier onlySelf() {
        require(address(this) == msg.sender, "MultiSigOracle: caller must be self");
        _;
    }

    // ============================ onlyWhitelist =====================================

    function assignJob(
        uint16 _dstChainId,
        uint16 _outboundProofType,
        uint64 _outboundBlockConfirmation,
        address _userApplication
    ) external override returns (uint fee) {
        if (useMso) {
            require(ulns[msg.sender], "MultiSigOracle: caller must be uln");
            fee = _getFee(_dstChainId, _outboundProofType, _outboundBlockConfirmation, _userApplication);
            emit AssignJob(_dstChainId, _outboundProofType, _outboundBlockConfirmation, _userApplication, fee);
        } else {
            if (address(uln) != msg.sender) {
                require(whitelist[msg.sender], "Oracle: not in whitelist");
            }
            fee = _getFee(_dstChainId, _outboundProofType, _outboundBlockConfirmation, _userApplication);
            emit AssignJob(_dstChainId, _outboundProofType, _outboundBlockConfirmation, _userApplication, fee);
        }
        fee;
    }

    // ============================ onlySelf =====================================

    function setSigner(address _signer, bool _active) external onlySelf {
        _revertIfOracle();
        _setSigner(_signer, _active);
    }

    function setQuorum(uint64 _quorum) external onlySelf {
        _revertIfOracle();
        _setQuorum(_quorum);
    }

    function setAllowlist(address _userApplication, bool _allowed) external onlySelf {
        _revertIfOracle();
        _setAllowlist(_userApplication, _allowed);
    }

    function setDenylist(address _userApplication, bool _denied) external onlySelf {
        _revertIfOracle();
        _setDenylist(_userApplication, _denied);
    }

    function setUln(address _uln, bool _active) external onlySelf {
        _revertIfOracle();
        require(ulns[_uln] != _active, "MultiSigOracle: uln already in that state");
        ulns[_uln] = _active;
        emit SetUln(_uln, _active);
    }

    // ============================ OnlyOwner =====================================

    function setValidator(address _addr, bool _active) external onlyOwner {
        _revertIfMso();
        require(validators[_addr] != _active, "Oracle: validator already in that state");
        validators[_addr] = _active;
        if (_active) {
            committeeSize++;
        } else {
            committeeSize--;
        }
        require(committeeSize >= threshold, "Oracle: committee size < threshold");
        emit ValidatorUpdated(_addr, _active);
    }

    function setWhitelist(address _addr, bool _active) external onlyOwner {
        _revertIfMso();
        whitelist[_addr] = _active;
        emit WhitelistUpdated(_addr, _active);
    }

    function setThreshold(uint16 _threshold) external onlyOwner {
        _revertIfMso();
        require(_threshold <= committeeSize, "Oracle: threshold > committee size");
        threshold = _threshold;
        emit ThresholdUpdated(_threshold);
    }

    // ============================ External =======================================

    function isApproved(address _address) public view returns (bool) {
        _revertIfMso();
        return _address == address(this);
    }

    // ============================ OnlyAdmin =====================================

    // signer can call this function to:
    // 1. submit a block data to ULN
    // 2. change configuration of this oracle
    // 3. withdraw fee from ULN
    function execute(
        address _target,
        bytes calldata _callData,
        uint _expiration,
        bytes calldata _signatures
    ) external onlyAdmin {
        _revertIfOracle();
        require(ulns[_target] || _target == address(this), "MultiSigOracle: target must be uln or self");
        require(_expiration > block.timestamp, "MultiSigOracle: call data expired");

        // generate and validate hash
        bytes32 hash = hashCallData(_target, _callData, _expiration);
        require(!usedHashes[hash], "MultiSigOracle: call data already executed");
        usedHashes[hash] = true; // prevent reentry and replay attack

        // check signatures
        verifySignatures(hash, _signatures);

        // execute call data
        (bool success, bytes memory rtnData) = _target.call(_callData);
        emit Execute(_target, hash, success, rtnData);
    }

    function setDstPrice(uint16 _dstChainId, uint128 _dstPriceRatio, uint128 _dstGasPriceInWei) external onlyAdmin {
        // Old no longer used. Should set price in PriceFeed contract.
    }

    function setPriceFeed(address _priceFeed) external onlyAdmin {
        priceFeed = ILayerZeroPriceFeed(_priceFeed);
        emit UpdatePriceFeed(_priceFeed);
    }

    function setPriceMultiplierBps(uint128 _multiplierBps) external onlyAdmin {
        multiplierBps = _multiplierBps;
        emit UpdatePriceMultiplierBps(_multiplierBps);
    }

    function setDstGas(uint16 _dstChainId, uint16 _proofType, uint64 _gas) external onlyAdmin {
        dstGasLookup[_dstChainId][_proofType] = _gas;
        emit SetDstGas(_dstChainId, _proofType, _gas);
    }

    function withdrawFee(address payable _to, uint _amount) external override onlyAdmin {
        _revertIfMso();
        uln.withdrawNative(_to, _amount);
    }

    function withdrawToken(address _token, address _to, uint _amount) external onlyAdmin {
        IERC20(_token).safeTransfer(_to, _amount);
    }

    function withdrawFeeFromUlnV2Like(address _uln, address payable _to, uint _amount) external onlyAdmin {
        _revertIfOracle();
        require(ulns[_uln], "MultiSigOracle: _uln is not allowed");
        ILayerZeroUltraLightNodeV2(_uln).withdrawNative(_to, _amount);
    }

    function setUseMso(bool _useMso) external onlyAdmin {
        useMso = _useMso;
    }

    function setAdmin(address _admin, bool _active) external onlyAdmin {
        if (useMso) {
            require(admins[_admin] != _active, "MultiSigOracle: admin already in that state");
            admins[_admin] = _active;
            emit UpdateAdmin(_admin, _active);
        } else {
            admins[_admin] = _active;
            emit AdminUpdated(_admin, _active);
        }
    }

    // ============================ OnlyValidator =====================================

    function validateBlock(
        uint16 _srcChainId,
        bytes32 _lookupHash,
        uint _confirmations,
        bytes32 _data
    ) external onlyValidator {
        _revertIfMso();
        ProposedBlock storage pb = proposalLookup[_srcChainId][_lookupHash][_confirmations][_data];
        require(!pb.submitted, "Oracle: already submitted");
        require(!pb.approvedBy[msg.sender], "Oracle: already approved block");
        uint16 approvalCount = pb.approvalCount;
        if (approvalCount + 1 == threshold) {
            // just submit it, not need to store locally to save gas
            uln.updateHash(_srcChainId, _lookupHash, _confirmations, _data);
            // only write this field to save gas. no need to write dta and approvalCount
            pb.submitted = true;
        } else {
            // update records
            pb.approvedBy[msg.sender] = true;
            pb.approvalCount = approvalCount + 1;
        }
        emit ValidatedBlock(msg.sender, _srcChainId, _lookupHash, _confirmations, _data);
    }

    // ============================ View Functions =======================================

    function getFee(
        uint16 _dstChainId,
        uint16 _outboundProofType,
        uint64 _outboundBlockConfirmation,
        address _userApplication
    ) external view override returns (uint) {
        return _getFee(_dstChainId, _outboundProofType, _outboundBlockConfirmation, _userApplication);
    }

    function hashCallData(address _target, bytes calldata _callData, uint _expiration) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_target, _expiration, _callData));
    }

    // ============================ Internal =======================================

    function _revertIfMso() internal view {
        if (useMso) {
            revert("MultiSigOracle: deprecated");
        }
    }

    function _revertIfOracle() internal view {
        if (!useMso) {
            revert("Oracle: not implemented");
        }
    }

    function _getFee(
        uint16 _dstChainId,
        uint16 _outboundProofType,
        uint64,
        address _userApplication
    ) internal view returns (uint) {
        if (useMso) {
            require(checkPermission(_userApplication), "MultiSigOracle: _userApplication is not allowed");

            uint dstGas = dstGasLookup[_dstChainId][_outboundProofType];

            uint totalSignatureBytes = uint(quorum) * signatureRawBytes;
            uint totalSignatureBytesPadded = totalSignatureBytes;
            if (totalSignatureBytes % 32 != 0) {
                totalSignatureBytesPadded = totalSignatureBytes - (totalSignatureBytes % 32) + 32;
            }
            // getFee should charge on execute(updateHash)
            // totalSignatureBytesPadded also has 64 overhead for bytes
            uint callDataSize = uint(executeFixedBytes) + updateHashBytes + totalSignatureBytesPadded + 64;
            uint16 dstChainId = _dstChainId; // stack too deep
            (uint fee, ) = priceFeed.estimateFeeByChain(dstChainId, callDataSize, dstGas);
            return (fee * multiplierBps) / 10000;
        } else {
            uint64 dstGas = dstGasLookup[_dstChainId][_outboundProofType];

            // callDataSize = 4 + 32 * 4 (all params are fixed bytes32)
            (uint fee, ) = priceFeed.estimateFeeByChain(_dstChainId, validateBlockBytes, dstGas);
            return (fee * threshold * multiplierBps) / 10000;
        }
    }

    // submit to uln
    function isBlockHashUpdated(
        uint16 _srcChainId,
        bytes32 _lookupHash,
        uint _confirmations,
        bytes32 _data
    ) external view returns (bool) {
        _revertIfMso();
        ProposedBlock storage pb = proposalLookup[_srcChainId][_lookupHash][_confirmations][_data];
        return pb.submitted;
    }

    function isBlockValidated(
        uint16 _srcChainId,
        bytes32 _lookupHash,
        uint _confirmations,
        bytes32 _data,
        address _addr
    ) external view returns (bool) {
        _revertIfMso();
        ProposedBlock storage pb = proposalLookup[_srcChainId][_lookupHash][_confirmations][_data];
        // if the pb has been submitted, consider it validated anyway. because a submission will fail.
        if (pb.submitted) return true;
        return pb.approvedBy[_addr];
    }

    function committeeStatus() external view returns (uint16, uint16) {
        _revertIfMso();
        return (committeeSize, threshold);
    }

    // view function to convert pricefeed price to current price (for backwards compatibility)
    function dstPriceLookup(uint16 _dstChainId) public view returns (DstPrice memory) {
        ILayerZeroPriceFeed.Price memory price = priceFeed.getPrice(_dstChainId);
        return DstPrice(price.priceRatio, price.gasPriceInUnit);
    }

    // ============================ MultiSig Functions =======================================

    function _setSigner(address _signer, bool _active) internal {
        require(signers[_signer] != _active, "MultiSig: signer already in that state");
        signers[_signer] = _active;
        signerSize = _active ? signerSize + 1 : signerSize - 1;
        require(signerSize >= quorum, "MultiSig: committee size < threshold");
        emit UpdateSigner(_signer, _active);
    }

    function _setQuorum(uint64 _quorum) internal {
        require(_quorum <= signerSize && _quorum > 0, "MultiSig: invalid quorum");
        quorum = _quorum;
        emit UpdateQuorum(_quorum);
    }

    function verifySignatures(bytes32 _hash, bytes calldata _signatures) public view {
        require(_signatures.length >= uint(quorum) * 65, "MultiSig: signatures too short");

        bytes32 messageDigest = _getEthSignedMessageHash(_hash);

        address lastSigner = address(0); // There cannot be a signer with address 0.
        for (uint i = 0; i < quorum; i++) {
            (uint8 v, bytes32 r, bytes32 s) = _splitSignature(_signatures, i);
            address currentSigner = ecrecover(messageDigest, v, r, s);

            require(currentSigner > lastSigner, "MultiSig: signatures must be in ascending order"); // prevent duplicate signatures
            require(signers[currentSigner], "MultiSig: signature is not from a signer");
            lastSigner = currentSigner;
        }
    }

    /// divides bytes signature into `uint8 v, bytes32 r, bytes32 s`.
    function _splitSignature(
        bytes memory _signatures,
        uint256 _pos
    ) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let signaturePos := mul(0x41, _pos)
            r := mload(add(_signatures, add(signaturePos, 0x20)))
            s := mload(add(_signatures, add(signaturePos, 0x40)))
            // Here we are loading the last 32 bytes, including 31 bytes
            // of 's'. There is no 'mload8' to do this.
            //
            // 'byte' is not working due to the Solidity parser, so lets
            // use the second best option, 'and'
            v := and(mload(add(_signatures, add(signaturePos, 0x41))), 0xff)
        }
    }

    function _getEthSignedMessageHash(bytes32 _messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
    }

    // ============================ AccessControl Functions =======================================
    function _setAllowlist(address _addr, bool _allowed) internal {
        require(allowlist[_addr] != _allowed, "AccessControl: address already in that state");
        allowlist[_addr] = _allowed;
        allowlistSize = _allowed ? allowlistSize + 1 : allowlistSize - 1;
        emit UpdateAllowlist(_addr, _allowed);
    }

    function _setDenylist(address _addr, bool _denied) internal {
        require(denylist[_addr] != _denied, "AccessControl: address already in that state");
        denylist[_addr] = _denied;
        emit UpdateDenylist(_addr, _denied);
    }

    /// 1) If one address is in the deny list, it is denied
    /// 2) If the allow list is empty and not in the deny list, it is allowed
    /// 3) If one address is in the allow list and not in the deny list, it is allowed
    /// 4) If the allow list is not empty and the address is not in the allow list, it is denied
    function checkPermission(address _address) public view returns (bool) {
        if (denylist[_address]) {
            return false;
        } else if (allowlist[_address]) {
            return true;
        } else if (allowlistSize > 0) {
            return false;
        } else {
            return true;
        }
    }
}
