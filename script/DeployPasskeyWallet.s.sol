// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PasskeyWallet} from "../src/PasskeyWallet.sol";

contract DeployPasskeyWallet is Script {
    function run() external {
        // 1. Get the private key from the environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        // 2. Define the REAL passkey coordinates
        uint256[] memory ownerXs = new uint256[](1);
        ownerXs[0] = 0x9fbb3442fb18eb9c3642cbf020854d4a64d556654c5c13a6cea60e7e84f89e30;
        
        uint256[] memory ownerYs = new uint256[](1);
        ownerYs[0] = 0xd4e3c47981cfd5009df576153b6f01e7a2139f847f0803ac24a807d20fb6cacf;

        // 3. Start broadcasting
        vm.startBroadcast(deployerPrivateKey);

        // 4. Deploy the V2 contract
        PasskeyWallet wallet = new PasskeyWallet(ownerXs, ownerYs, deployerAddress);

        // 5. Stop broadcasting
        vm.stopBroadcast();

        // 6. Print results
        console.log("==========================================");
        console.log("Passkey Wallet V2 deployed successfully!");
        console.log("Contract Address:", address(wallet));
        console.log("Guardian Address:", deployerAddress);
        console.log("==========================================");
    }
}