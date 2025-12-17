// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/X402HelloWorld.sol";

contract ExecuteWorkflow is Script {
    function run() external {
        address contractAddress = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
        X402HelloWorld x402 = X402HelloWorld(contractAddress);

        address recipient = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8); // Anvil account 1

        vm.startBroadcast();

        // Step 1: Start workflow
        console.log("1. Starting workflow...");
        bytes32 workflowId = x402.startWorkflow();
        console.log("Workflow ID:", uint256(workflowId));

        // Step 2: Record decision (approve)
        console.log("2. Recording decision (approved)...");
        x402.recordDecision(workflowId, true, "Payment verified and approved");

        // Step 3: Execute payment
        console.log("3. Executing payment...");
        x402.executePayment{value: 0.1 ether}(workflowId, payable(recipient));

        // Step 4: Complete workflow
        console.log("4. Completing workflow...");
        x402.completeWorkflow(workflowId);

        console.log("Workflow completed successfully!");

        vm.stopBroadcast();
    }
}
