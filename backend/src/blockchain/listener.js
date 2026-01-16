/**
 * Blockchain event listener with persistent storage
 * Subscribes to contract events and stores them in database with ordering metadata
 * 
 * Events flow:
 * 1. Contract emits event on-chain
 * 2. Provider receives event via WebSocket/HTTP polling
 * 3. Listener fetches receipt and block for ordering metadata
 * 4. Stores in ChainEvent table (immutable, append-only)
 * 5. Updates WorkflowState using deterministic reducer
 * 
 * Reorg safety: Only processes events with >= CONFIRMATION_BLOCKS confirmations
 */

import { getContract, Events } from './contract.js';
import { getPrismaClient } from '../db/db.js';
import { reduceWorkflow } from '../db/reducer.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { getProvider } from './provider.js';

let isListening = false;
let currentBlockNumber = 0;

/**
 * Process and persist a single event
 * @param {Object} event - ethers.js event object
 * @param {string} eventType - Event type enum
 * @param {Object} payload - Event payload
 */
async function processAndPersistEvent(event, eventType, payload) {
    const prisma = getPrismaClient();
    const provider = getProvider();

    try {
        // Extract workflow ID
        const workflowId = event.args[0].toString(); // First arg is always workflowId

        // Fetch transaction receipt for ordering metadata
        const receipt = await provider.getTransactionReceipt(event.log.transactionHash);

        // Fetch block for timestamp
        const block = await provider.getBlock(event.log.blockNumber);

        // Check confirmation depth (reorg safety)
        const confirmations = currentBlockNumber - event.log.blockNumber;
        if (confirmations < config.confirmationBlocks) {
            logger.debug('Event not yet confirmed, skipping', {
                workflowId,
                eventType,
                blockNumber: event.log.blockNumber,
                confirmations,
                required: config.confirmationBlocks,
            });
            return;
        }

        // Prepare event data
        const eventData = {
            workflowId,
            eventType,
            payload,
            blockNumber: BigInt(event.log.blockNumber),
            transactionIndex: receipt.index,
            logIndex: event.log.index,
            txHash: event.log.transactionHash,
            blockHash: event.log.blockHash,
            blockTimestamp: BigInt(block.timestamp),
        };

        // Store in ChainEvent table (idempotent due to unique constraint)
        await prisma.chainEvent.upsert({
            where: {
                txHash_logIndex: {
                    txHash: eventData.txHash,
                    logIndex: eventData.logIndex,
                },
            },
            update: {}, // No-op if already exists
            create: eventData,
        });

        logger.info('Event persisted', {
            workflowId,
            eventType,
            blockNumber: event.log.blockNumber,
            txHash: eventData.txHash,
        });

        // Fetch current workflow state
        let workflowState = await prisma.workflowState.findUnique({
            where: { workflowId },
        });

        // Apply reducer to update state
        const newState = reduceWorkflow(workflowState, eventData);

        if (newState) {
            // Update WorkflowState
            await prisma.workflowState.upsert({
                where: { workflowId },
                update: {
                    status: newState.status,
                    initiator: newState.initiator,
                    startedAt: newState.startedAt,
                    completedAt: newState.completedAt,
                    failureReason: newState.failureReason,
                    lastEventBlock: newState.lastEventBlock,
                    lastEventLogIndex: newState.lastEventLogIndex,
                },
                create: {
                    workflowId,
                    status: newState.status,
                    initiator: newState.initiator,
                    startedAt: newState.startedAt,
                    completedAt: newState.completedAt,
                    failureReason: newState.failureReason,
                    lastEventBlock: newState.lastEventBlock,
                    lastEventLogIndex: newState.lastEventLogIndex,
                },
            });

            logger.info('Workflow state updated', {
                workflowId,
                status: newState.status,
            });
        }

        // Update system state checkpoint
        await prisma.systemState.update({
            where: { id: 1 },
            data: { lastProcessedBlock: BigInt(event.log.blockNumber) },
        });

    } catch (error) {
        // Ignore duplicate key errors (idempotency)
        if (error.code === 'P2002') {
            logger.debug('Event already processed (duplicate)', {
                txHash: event.log.transactionHash,
                logIndex: event.log.logIndex,
            });
            return;
        }

        logger.error('Error processing event', {
            eventType,
            error: error.message,
            stack: error.stack,
        });
    }
}

/**
 * Start event listener
 */
export function startEventListener() {
    if (isListening) {
        logger.warn('Event listener already running');
        return;
    }

    const contract = getContract();
    const provider = getProvider();

    // Track current block number for confirmation depth
    provider.on('block', (blockNumber) => {
        currentBlockNumber = blockNumber;
    });

    // WorkflowStarted event
    contract.on(Events.WORKFLOW_STARTED, async (workflowId, initiator, event) => {
        await processAndPersistEvent(
            event,
            'WORKFLOW_STARTED',
            { initiator }
        );
    });

    // DecisionRecorded event
    contract.on(Events.DECISION_RECORDED, async (workflowId, approved, reason, event) => {
        await processAndPersistEvent(
            event,
            'DECISION_RECORDED',
            { approved, reason }
        );
    });

    // PaymentExecuted event
    contract.on(Events.PAYMENT_EXECUTED, async (workflowId, to, amount, event) => {
        await processAndPersistEvent(
            event,
            'PAYMENT_EXECUTED',
            { to, amount: amount.toString() }
        );
    });

    // WorkflowCompleted event
    contract.on(Events.WORKFLOW_COMPLETED, async (workflowId, event) => {
        await processAndPersistEvent(
            event,
            'WORKFLOW_COMPLETED',
            {}
        );
    });

    // WorkflowFailed event
    contract.on(Events.WORKFLOW_FAILED, async (workflowId, reason, event) => {
        await processAndPersistEvent(
            event,
            'WORKFLOW_FAILED',
            { reason }
        );
    });

    isListening = true;
    logger.info('Event listener started', {
        contractAddress: config.contractAddress,
        confirmationBlocks: config.confirmationBlocks,
        events: Object.values(Events),
    });
}

/**
 * Stop event listener
 */
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

/**
 * Get listener status
 */
export function getListenerStatus() {
    return {
        isListening,
        currentBlockNumber,
        contractAddress: config.contractAddress,
        confirmationBlocks: config.confirmationBlocks,
        events: Object.values(Events),
    };
}
