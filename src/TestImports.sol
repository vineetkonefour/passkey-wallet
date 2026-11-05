// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Importing the ERC-4337 v0.7 interfaces
import {IAccount} from "account-abstraction/interfaces/IAccount.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

// Importing the P-256 verifier
import {P256Verifier} from "p256-verifier/src/P256Verifier.sol";

contract TestImports is IAccount {
    // This is the only function required by the v0.7 IAccount interface
    function validateUserOp(
        PackedUserOperation calldata userOp, 
        bytes32 userOpHash, 
        uint256 missingAccountFunds
    ) external pure override returns (uint256 validationData) {
        return 0;
    }
}