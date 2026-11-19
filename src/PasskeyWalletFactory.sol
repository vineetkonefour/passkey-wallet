// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PasskeyWallet} from "./PasskeyWallet.sol";

contract PasskeyWalletFactory {
    function createAccount(
        uint256[] calldata ownerXs,
        uint256[] calldata ownerYs,
        address guardian,
        uint256 salt
    ) external returns (address) {
        address addr = getAddress(ownerXs, ownerYs, guardian, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return addr;
        }
        
        bytes32 _salt = keccak256(abi.encode(ownerXs[0], guardian, salt));
        return address(new PasskeyWallet{salt: _salt}(ownerXs, ownerYs, guardian));
    }

    function getAddress(
        uint256[] calldata ownerXs,
        uint256[] calldata ownerYs,
        address guardian,
        uint256 salt
    ) public view returns (address) {
        bytes32 _salt = keccak256(abi.encode(ownerXs[0], guardian, salt));
        
        // EVM strictly requires encodePacked for CREATE2 bytecode hash
        // slither-disable-next-line encode-packed-collision
        bytes32 bytecodeHash = keccak256(abi.encodePacked(type(PasskeyWallet).creationCode, abi.encode(ownerXs, ownerYs, guardian)));
        
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            _salt,
            bytecodeHash
        )))));
    }
}