/**
 * Blockchain event listener with polling-based ingestion
 * Polls contract logs using eth_getLogs to work around RPC limitations
 * 
 * Events flow:
 * 1. Poll every N seconds for new logs
 * 2. Query logs from lastProcessedBlock + 1 to latestBlock - confirmationBlocks
 * 3. Fetch receipt and block for ordering metadata
 * 4. Store in ChainEvent table (immutable, append-only)
 * 5. Update WorkflowState using deterministic reducer
 * 
 * Reorg safety: Only processes events with >= CONFIRMATION_BLOCKS confirmations
 */

import { getContract, Events } from './contract.js';
import { getPrismaClient } from '../db/db.js';
import { reduceWorkflow } from '../db/reducer.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { getProvider } from './provider.js';

let pollingInterval = null;
let isListening = false;

/**
 * Process and persist a single event
 * @param {Object} log - Raw log from eth_getLogs
 * @param {string} eventType - Event type enum
 * @param {Object} parsedArgs - Parsed event arguments
 */
async function processAndPersistEvent(log, eventType, parsedArgs) {
    const prisma = getPrismaClient();
    const provider = getProvider();

    try {
        // Extract workflow ID (first argument in all events)
        const workflowId = parsedArgs[0].toString();

        // Fetch transaction receipt for ordering metadata
        const receipt = await provider.getTransactionReceipt(log.transactionHash);

        // Fetch block for timestamp
        const block = await provider.getBlock(log.blockNumber);

        // Prepare payload based on event type
        let payload = {};
        switch (eventType) {
            case 'WORKFLOW_STARTED':
                payload = { initiator: parsedArgs[1] };
                break;
            case 'DECISION_RECORDED':
                payload = { approved: parsedArgs[1], reason: parsedArgs[2] };
                break;
            case 'PAYMENT_EXECUTED':
                payload = { to: parsedArgs[1], amount: parsedArgs[2].toString() };
                break;
            case 'WORKFLOW_COMPLETED':
                payload = {};
                break;
            case 'WORKFLOW_FAILED':
                payload = { reason: parsedArgs[1] };
                break;
        }

        // Prepare event data
        const eventData = {
            workflowId,
            eventType,
            payload,
            blockNumber: BigInt(log.blockNumber),
            transactionIndex: receipt.index,
            logIndex: log.index,
            txHash: log.transactionHash,
            blockHash: log.blockHash,
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
            blockNumber: log.blockNumber,
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

    } catch (error) {
        // Ignore duplicate key errors (idempotency)
        if (error.code === 'P2002') {
            logger.debug('Event already processed (duplicate)', {
                txHash: log.transactionHash,
                logIndex: log.logIndex,
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
 * Poll for new events
 */
async function pollEvents() {
    const prisma = getPrismaClient();
    const provider = getProvider();
    const contract = getContract();

    try {
        // Get current block number
        const latestBlock = await provider.getBlockNumber();

        // Get last processed block from database
        const systemState = await prisma.systemState.findUnique({ where: { id: 1 } });
        const lastProcessedBlock = systemState ? Number(systemState.lastProcessedBlock) : config.blockStart;

        // Calculate safe block range (with confirmation depth)
        const toBlock = latestBlock - config.confirmationBlocks;
        const fromBlock = lastProcessedBlock + 1;

        // Skip if no new confirmed blocks
        if (fromBlock > toBlock) {
            logger.debug('No new confirmed blocks to process', {
                lastProcessedBlock,
                latestBlock,
                confirmationBlocks: config.confirmationBlocks,
            });
            return;
        }

        // RPC providers often have block range limits (e.g., 2000 blocks)
        // Chunk the range to avoid errors
        const MAX_BLOCK_RANGE = 2000;
        const chunks = [];

        for (let start = fromBlock; start <= toBlock; start += MAX_BLOCK_RANGE) {
            const end = Math.min(start + MAX_BLOCK_RANGE - 1, toBlock);
            chunks.push({ from: start, to: end });
        }

        logger.info('Polling for events', {
            fromBlock,
            toBlock,
            totalRange: toBlock - fromBlock + 1,
            chunks: chunks.length,
        });

        // Query logs for all event types
        const eventTypes = [
            { name: 'WORKFLOW_STARTED', event: Events.WORKFLOW_STARTED },
            { name: 'DECISION_RECORDED', event: Events.DECISION_RECORDED },
            { name: 'PAYMENT_EXECUTED', event: Events.PAYMENT_EXECUTED },
            { name: 'WORKFLOW_COMPLETED', event: Events.WORKFLOW_COMPLETED },
            { name: 'WORKFLOW_FAILED', event: Events.WORKFLOW_FAILED },
        ];

        let totalLogs = 0;

        // Process each chunk
        for (const chunk of chunks) {
            for (const { name, event } of eventTypes) {
                const filter = contract.filters[event]();
                const logs = await provider.getLogs({
                    address: config.contractAddress,
                    topics: filter.topics,
                    fromBlock: chunk.from,
                    toBlock: chunk.to,
                });

                if (logs.length > 0) {
                    logger.debug(`Found ${logs.length} ${name} events in blocks ${chunk.from}-${chunk.to}`);
                }

                for (const log of logs) {
                    const parsed = contract.interface.parseLog(log);
                    await processAndPersistEvent(log, name, parsed.args);
                    totalLogs++;
                }
            }
        }

        // Update last processed block
        if (totalLogs > 0 || toBlock > lastProcessedBlock) {
            await prisma.systemState.update({
                where: { id: 1 },
                data: { lastProcessedBlock: BigInt(toBlock) },
            });

            logger.info('Polling complete', {
                eventsProcessed: totalLogs,
                lastProcessedBlock: toBlock,
            });
        }

    } catch (error) {
        logger.error('Error during polling', {
            error: error.message,
            stack: error.stack,
        });
    }
}

/**
 * Start event listener with polling
 */
export function startEventListener() {
    if (isListening) {
        logger.warn('Event listener already running');
        return;
    }

    // Start polling loop
    pollingInterval = setInterval(pollEvents, config.pollIntervalMs);
    isListening = true;

    logger.info('Event listener started (polling mode)', {
        contractAddress: config.contractAddress,
        confirmationBlocks: config.confirmationBlocks,
        pollIntervalMs: config.pollIntervalMs,
        events: Object.values(Events),
    });

    // Run initial poll immediately
    pollEvents().catch(error => {
        logger.error('Initial poll failed', { error: error.message });
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

    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }

    isListening = false;
    logger.info('Event listener stopped');
}

/**
 * Get listener status
 */
export function getListenerStatus() {
    return {
        isListening,
        mode: 'polling',
        contractAddress: config.contractAddress,
        confirmationBlocks: config.confirmationBlocks,
        pollIntervalMs: config.pollIntervalMs,
        events: Object.values(Events),
    };
}
