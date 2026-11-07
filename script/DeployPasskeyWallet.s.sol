// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PasskeyWallet} from "../src/PasskeyWallet.sol";

contract DeployPasskeyWallet is Script {
    function run() external {
        // 1. Get the private key from the environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // 2. Derive the deployer's address to act as the Guardian
        address deployerAddress = vm.addr(deployerPrivateKey);

        // 3. Define the placeholder passkey coordinates as ARRAYS
        uint256[] memory ownerXs = new uint256[](1);
        ownerXs[0] = 0x1111111111111111111111111111111111111111111111111111111111111111;
        
        uint256[] memory ownerYs = new uint256[](1);
        ownerYs[0] = 0x2222222222222222222222222222222222222222222222222222222222222222;

        // 4. Start broadcasting
        vm.startBroadcast(deployerPrivateKey);

        // 5. Deploy the V2 contract (Notice the 3 arguments now!)
        PasskeyWallet wallet = new PasskeyWallet(ownerXs, ownerYs, deployerAddress);

        // 6. Stop broadcasting
        vm.stopBroadcast();

        // 7. Print results
        console.log("==========================================");
        console.log("Passkey Wallet V2 deployed successfully!");
        console.log("Contract Address:", address(wallet));
        console.log("Guardian Address:", deployerAddress);
        console.log("==========================================");
    }
}