// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol"; // <-- Added this line
import {PasskeyWalletFactory} from "../src/PasskeyWalletFactory.sol";

contract DeployFactory is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        PasskeyWalletFactory factory = new PasskeyWalletFactory();
        vm.stopBroadcast();
        
        console.log("==========================================");
        console.log("Factory deployed successfully!");
        console.log("Factory Address:", address(factory));
        console.log("==========================================");
    }
}