// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAccount} from "account-abstraction/interfaces/IAccount.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

contract PasskeyWallet is IAccount {
    
    // 1. State Variables for Multi-Device Support
    mapping(uint256 => uint256) public passkeys;

    // 2. State Variable for Recovery
    address public guardian;

    // The built-in RIP-7212 P-256 precompile address on Base Sepolia
    address constant P256_PRECOMPILE = 0x0000000000000000000000000000000000000100;

    // 3. Constructor
    constructor(uint256[] memory _ownerXs, uint256[] memory _ownerYs, address _guardian) {
        require(_ownerXs.length == _ownerYs.length, "Mismatched key lengths");
        require(_guardian != address(0), "Invalid guardian");
        
        guardian = _guardian;
        
        for (uint256 i = 0; i < _ownerXs.length; i++) {
            passkeys[_ownerXs[i]] = _ownerYs[i];
        }
    }

    // 4. The Core ERC-4337 Validation Function
    function validateUserOp(
        PackedUserOperation calldata userOp, 
        bytes32 userOpHash, 
        uint256 _missingAccountFunds 
    ) external view override returns (uint256 validationData) {
        bytes calldata signature = userOp.signature;
        require(signature.length >= 64, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        assembly {
            r := calldataload(add(signature.offset, 0))
            s := calldataload(add(signature.offset, 32))
        }
        
        uint256 ownerX = uint256(bytes32(userOp.signature[64:96]));
        uint256 ownerY = passkeys[ownerX];
        
        require(ownerY != 0, "Passkey not registered");

        bytes memory input = abi.encode(userOpHash, uint256(r), uint256(s), ownerX, ownerY);
        (bool success, bytes memory result) = P256_PRECOMPILE.staticcall(input);
        
        bool isValid = success && result.length == 32 && abi.decode(result, (uint256)) == 1;
        validationData = isValid ? 0 : 1;
    }

    // 5. The Execution Function
    function execute(address target, uint256 value, bytes calldata data) external {
        require(target != address(0), "PasskeyWallet: invalid target");
        (bool success, ) = target.call{value: value}(data);
        require(success, "PasskeyWallet: execution failed");
    }

    // 6. Recovery Functions
    function addPasskey(uint256 _ownerX, uint256 _ownerY) external {
        require(msg.sender == guardian, "Only guardian can add passkeys");
        require(_ownerY != 0, "Invalid Y coordinate");
        passkeys[_ownerX] = _ownerY;
    }

    function removePasskey(uint256 _ownerX) external {
        require(msg.sender == guardian, "Only guardian can remove passkeys");
        delete passkeys[_ownerX];
    }
}