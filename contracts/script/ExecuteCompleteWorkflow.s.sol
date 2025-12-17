// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/X402HelloWorld.sol";

contract ExecuteCompleteWorkflow is Script {
    function run() external {
        address contractAddress = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
        X402HelloWorld x402 = X402HelloWorld(contractAddress);

        address recipient = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8); // Anvil account 1

        vm.startBroadcast();

        // Step 1: Start workflow
        console.log("");
        console.log("========== STARTING NEW WORKFLOW ==========");
        bytes32 workflowId = x402.startWorkflow();
        console.log("Workflow ID:", uint256(workflowId));
        console.log("Initiator:", msg.sender);

        // Check state
        X402HelloWorld.WorkflowState state = x402.getWorkflowState(workflowId);
        console.log("State after start:", uint256(state)); // Should be 1 (Active)

        vm.stopBroadcast();

        // Pause between steps to allow backend to process
        console.log("Waiting 2 seconds for backend to process...");
        vm.sleep(2000);

        vm.startBroadcast();

        // Step 2: Record decision (approve)
        console.log("");
        console.log("========== RECORDING DECISION ==========");
        x402.recordDecision(
            workflowId,
            true,
            "Payment verified and approved by agent"
        );
        state = x402.getWorkflowState(workflowId);
        console.log("State after decision:", uint256(state)); // Should be 2 (Approved)

        vm.stopBroadcast();

        console.log("Waiting 2 seconds for backend to process...");
        vm.sleep(2000);

        vm.startBroadcast();

        // Step 3:Execute payment
        console.log("");
        console.log("========== EXECUTING PAYMENT ==========");
        console.log("Sending 0.1 ETH to:", recipient);
        x402.executePayment{value: 0.1 ether}(workflowId, payable(recipient));
        state = x402.getWorkflowState(workflowId);
        console.log("State after payment:", uint256(state)); // Should be 4 (Settled)

        vm.stopBroadcast();

        console.log("Waiting 2 seconds for backend to process...");
        vm.sleep(2000);

        vm.startBroadcast();

        // Step 4: Complete workflow
        console.log("");
        console.log("========== COMPLETING WORKFLOW ==========");
        x402.completeWorkflow(workflowId);
        state = x402.getWorkflowState(workflowId);
        console.log("State after completion:", uint256(state)); // Should be 5 (Completed)

        console.log("");
        console.log("========== WORKFLOW COMPLETED SUCCESSFULLY! ==========");
        console.log("Workflow ID:", uint256(workflowId));

        vm.stopBroadcast();
    }
}
