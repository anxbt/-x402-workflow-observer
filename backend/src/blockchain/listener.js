/**
 * Blockchain event listener
 * Subscribes to contract events and normalizes them into the memory store
 * 
 * Events flow:
 * 1. Contract emits event on-chain
 * 2. Provider receives event via WebSocket/polling
 * 3. Listener normalizes and stores in memoryStore
 * 4. API endpoints read from memoryStore
 * 
 * NOTE: On restart, historical events are NOT replayed
 * For production, implement:
 * - Event replay from BLOCK_START
 * - Persistent checkpoint storage
 * - Reorg handling
 */

import { getContract, Events } from './contract.js';
import { memoryStore } from '../store/memoryStore.js';
import { WorkflowStatus, config } from '../config.js';
import { logger } from '../utils/logger.js';

let isListening = false;

export function startEventListener() {
    if (isListening) {
        logger.warn('Event listener already running');
        return;
    }

    const contract = getContract();

    // WorkflowStarted event (bytes32 workflowId, address initiator)
    contract.on(Events.WORKFLOW_STARTED, (workflowId, initiator, event) => {
        try {
            const wfId = workflowId.toString();
            const ts = Math.floor(Date.now() / 1000); // Current timestamp since contract doesn't emit it

            memoryStore.createWorkflow(wfId, initiator, ts);

            logger.info('Event: WorkflowStarted', {
                workflowId: wfId,
                initiator,
                blockNumber: event.log.blockNumber,
            });
        } catch (error) {
            logger.error('Error handling WorkflowStarted', { error: error.message });
        }
    });

    // DecisionRecorded event (bytes32 workflowId, bool approved, string reason)
    contract.on(Events.DECISION_RECORDED, (workflowId, approved, reason, event) => {
        try {
            const wfId = workflowId.toString();

            memoryStore.addDecision(wfId, approved, reason);

            logger.info('Event: DecisionRecorded', {
                workflowId: wfId,
                approved,
                blockNumber: event.log.blockNumber,
            });
        } catch (error) {
            logger.error('Error handling DecisionRecorded', { error: error.message });
        }
    });

    // PaymentExecuted event (bytes32 workflowId, address to, uint256 amount)
    contract.on(Events.PAYMENT_EXECUTED, (workflowId, to, amount, event) => {
        try {
            const wfId = workflowId.toString();

            // Since contract doesn't emit 'from', we'll use the transaction sender
            const from = event.log.address; // Contract address, or get from tx

            memoryStore.addSettlement(wfId, from, to, amount);

            logger.info('Event: PaymentExecuted', {
                workflowId: wfId,
                to,
                amount: amount.toString(),
                blockNumber: event.log.blockNumber,
            });
        } catch (error) {
            logger.error('Error handling PaymentExecuted', { error: error.message });
        }
    });

    // WorkflowCompleted event (bytes32 workflowId)
    contract.on(Events.WORKFLOW_COMPLETED, (workflowId, event) => {
        try {
            const wfId = workflowId.toString();
            const ts = Math.floor(Date.now() / 1000); // Current timestamp

            memoryStore.updateWorkflowStatus(wfId, WorkflowStatus.COMPLETED, ts);

            logger.info('Event: WorkflowCompleted', {
                workflowId: wfId,
                blockNumber: event.log.blockNumber,
            });
        } catch (error) {
            logger.error('Error handling WorkflowCompleted', { error: error.message });
        }
    });

    // WorkflowFailed event (bytes32 workflowId, string reason)
    contract.on(Events.WORKFLOW_FAILED, (workflowId, reason, event) => {
        try {
            const wfId = workflowId.toString();
            const ts = Math.floor(Date.now() / 1000); // Current timestamp

            memoryStore.updateWorkflowStatus(wfId, WorkflowStatus.FAILED, ts, reason);

            logger.info('Event: WorkflowFailed', {
                workflowId: wfId,
                reason,
                blockNumber: event.log.blockNumber,
            });
        } catch (error) {
            logger.error('Error handling WorkflowFailed', { error: error.message });
        }
    });

    isListening = true;
    logger.info('Event listener started', {
        contractAddress: config.contractAddress,
        events: Object.values(Events),
    });
}

export function stopEventListener() {
    if (!isListening) {
        logger.warn('Event listener not running');
        return;
    }

    const contract = getContract();
    contract.removeAllListeners();

    isListening = false;
    logger.info('Event listener stopped');
}

export function getListenerStatus() {
    return {
        isListening,
        contractAddress: config.contractAddress,
        events: Object.values(Events),
    };
}
