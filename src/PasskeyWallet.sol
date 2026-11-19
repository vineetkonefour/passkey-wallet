// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAccount} from "account-abstraction/interfaces/IAccount.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

contract PasskeyWallet is IAccount {
    address public constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address private constant P256_VERIFIER = 0x0000000000000000000000000000000000000100;
    uint256 private constant SIG_VALIDATION_FAILED = 1;

    mapping(uint256 => uint256) public passkeys; // x => y
    address public guardian;

    constructor(uint256[] memory _ownerXs, uint256[] memory _ownerYs, address _guardian) {
        require(_ownerXs.length == _ownerYs.length, "Mismatched key lengths");
        require(_guardian != address(0), "Invalid guardian");
        guardian = _guardian;
        for (uint256 i = 0; i < _ownerXs.length; i++) {
            passkeys[_ownerXs[i]] = _ownerYs[i];
        }
    }

    modifier onlyEntryPoint() {
        require(msg.sender == ENTRY_POINT, "PasskeyWallet: not EntryPoint");
        _;
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        validationData = _isValidSignature(userOp.signature, userOpHash) ? 0 : SIG_VALIDATION_FAILED;

        if (missingAccountFunds != 0) {
            (bool paid, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            (paid); 
        }
    }

    function _isValidSignature(bytes calldata sig, bytes32 userOpHash) internal view returns (bool ok) {
        (
            bytes memory authData,
            bytes memory clientData,
            uint256 challengeIndex,
            uint256 typeIndex,
            uint256 r,
            uint256 s,
            uint256 x
        ) = abi.decode(sig, (bytes, bytes, uint256, uint256, uint256, uint256, uint256));

        ok = passkeys[x] != 0;
        ok = _flagsOk(authData) && ok;
        ok = _clientDataOk(clientData, challengeIndex, typeIndex, userOpHash) && ok;
        ok = _verifyP256(_webauthnDigest(authData, clientData), r, s, x, passkeys[x]) && ok;
    }

    function _webauthnDigest(bytes memory authData, bytes memory clientData) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(authData, sha256(clientData)));
    }

    function _flagsOk(bytes memory authData) internal pure returns (bool) {
        if (authData.length < 37) return false;
        return (uint8(authData[32]) & 0x05) == 0x05;
    }

    function _clientDataOk(
        bytes memory clientData,
        uint256 challengeIndex,
        uint256 typeIndex,
        bytes32 userOpHash
    ) internal pure returns (bool) {
        bool typeOk = _matchesAt(clientData, typeIndex, bytes('"type":"webauthn.get"'));
        bytes memory expectedChallenge = abi.encodePacked('"challenge":"', _base64Url32(userOpHash), '"');
        bool challengeOk = _matchesAt(clientData, challengeIndex, expectedChallenge);
        return typeOk && challengeOk;
    }

    function _matchesAt(bytes memory data, uint256 index, bytes memory expected) internal pure returns (bool) {
        if (index > data.length || data.length - index < expected.length) return false;
        for (uint256 i = 0; i < expected.length; i++) {
            if (data[index + i] != expected[i]) return false;
        }
        return true;
    }

    function _base64Url32(bytes32 h) internal pure returns (bytes memory out) {
        bytes memory T = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        out = new bytes(43);
        uint256 o;
        for (uint256 i = 0; i < 30; i += 3) {
            uint256 v = (uint256(uint8(h[i])) << 16) | (uint256(uint8(h[i + 1])) << 8) | uint256(uint8(h[i + 2]));
            out[o++] = T[(v >> 18) & 63];
            out[o++] = T[(v >> 12) & 63];
            out[o++] = T[(v >> 6) & 63];
            out[o++] = T[v & 63];
        }
        uint256 t = (uint256(uint8(h[30])) << 8) | uint256(uint8(h[31]));
        out[o++] = T[(t >> 10) & 63];
        out[o++] = T[(t >> 4) & 63];
        out[o++] = T[(t << 2) & 63];
    }

    function _verifyP256(bytes32 digest, uint256 r, uint256 s, uint256 x, uint256 y) internal view returns (bool) {
        (bool success, bytes memory result) = P256_VERIFIER.staticcall(abi.encode(digest, r, s, x, y));
        return success && result.length == 32 && abi.decode(result, (uint256)) == 1;
    }

    function execute(address target, uint256 value, bytes calldata data) external onlyEntryPoint {
        require(target != address(0), "PasskeyWallet: invalid target");
        (bool success, ) = target.call{value: value}(data);
        require(success, "PasskeyWallet: execution failed");
    }

    function addPasskey(uint256 _ownerX, uint256 _ownerY) external {
        require(msg.sender == guardian, "Only guardian can add passkeys");
        require(_ownerY != 0, "Invalid Y coordinate");
        passkeys[_ownerX] = _ownerY;
    }

    function removePasskey(uint256 _ownerX) external {
        require(msg.sender == guardian, "Only guardian can remove passkeys");
        delete passkeys[_ownerX];
    }

    receive() external payable {}
}