/**
 * Smart contract ABI and address
 * Defines the x402 workflow contract interface
 * 
 * NOTE: Update CONTRACT_ADDRESS in .env before running
 * ABI is hardcoded here - in production, fetch from chain or file
 */

import { ethers } from 'ethers';
import { config } from '../config.js';
import { getProvider } from './provider.js';

// x402 Workflow Contract ABI
// Matches the actual X402HelloWorld.sol contract
export const CONTRACT_ABI = [
    // WorkflowStarted(bytes32 workflowId, address initiator)
    'event WorkflowStarted(bytes32 indexed workflowId, address indexed initiator)',

    // DecisionRecorded(bytes32 workflowId, bool approved, string reason)
    'event DecisionRecorded(bytes32 indexed workflowId, bool approved, string reason)',

    // PaymentExecuted(bytes32 workflowId, address to, uint256 amount)
    'event PaymentExecuted(bytes32 indexed workflowId, address indexed to, uint256 amount)',

    // WorkflowCompleted(bytes32 workflowId)
    'event WorkflowCompleted(bytes32 indexed workflowId)',

    // WorkflowFailed(bytes32 workflowId, string reason)
    'event WorkflowFailed(bytes32 indexed workflowId, string reason)',
];

export function getContract() {
    const provider = getProvider();
    const contract = new ethers.Contract(
        config.contractAddress,
        CONTRACT_ABI,
        provider
    );

    return contract;
}

// Event names for easy reference
export const Events = {
    WORKFLOW_STARTED: 'WorkflowStarted',
    DECISION_RECORDED: 'DecisionRecorded',
    PAYMENT_EXECUTED: 'PaymentExecuted',
    WORKFLOW_COMPLETED: 'WorkflowCompleted',
    WORKFLOW_FAILED: 'WorkflowFailed',
};
