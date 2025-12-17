// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/X402HelloWorld.sol";

contract DeployX402 is Script {
    function run() external returns (address) {
        vm.startBroadcast();

        X402HelloWorld x402Contract = new X402HelloWorld();

        vm.stopBroadcast();

        console.log("X402HelloWorld deployed at:", address(x402Contract));
        return address(x402Contract);
    }
}
