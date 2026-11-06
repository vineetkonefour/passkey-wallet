// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAccount} from "account-abstraction/interfaces/IAccount.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

contract PasskeyWallet is IAccount {
    // 1. State Variables
    uint256 public ownerX;
    uint256 public ownerY;

    // The built-in RIP-7212 P-256 precompile address on Base Sepolia
    address constant P256_PRECOMPILE = 0x0000000000000000000000000000000000000100;

    // 2. Constructor
    constructor(uint256 _ownerX, uint256 _ownerY) {
        ownerX = _ownerX;
        ownerY = _ownerY;
    }

    // 3. The Core ERC-4337 Validation Function
    function validateUserOp(
        PackedUserOperation calldata userOp, 
        bytes32 userOpHash, 
        uint256 _missingAccountFunds // Added underscore to silence the unused warning
    ) external view override returns (uint256 validationData) {
        bytes calldata signature = userOp.signature;
        require(signature.length == 64, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        assembly {
            r := calldataload(add(signature.offset, 0))
            s := calldataload(add(signature.offset, 32))
        }
        
        bytes memory input = abi.encode(userOpHash, uint256(r), uint256(s), ownerX, ownerY);
        (bool success, bytes memory result) = P256_PRECOMPILE.staticcall(input);
        
        bool isValid = success && result.length == 32 && abi.decode(result, (uint256)) == 1;
        validationData = isValid ? 0 : 1;
    }

    // 4. The Execution Function
    function execute(address target, uint256 value, bytes calldata data) external {
        // Silences the zero-check warning and prevents accidental sends to 0x0
        require(target != address(0), "PasskeyWallet: invalid target");
        
        (bool success, ) = target.call{value: value}(data);
        require(success, "PasskeyWallet: execution failed");
    }
}