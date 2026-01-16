/**
 * Event replay module
 * Reconstructs workflow state from on-chain events
 * 
 * On startup:
 * 1. Query all ChainEvent rows ordered by (blockNumber, txIndex, logIndex)
 * 2. Group by workflowId
 * 3. Apply reducer to derive WorkflowState
 * 4. Update database with derived state
 * 
 * This ensures deterministic reconstruction from immutable event log
 */

import { getPrismaClient } from './db.js';
import { reduceWorkflowFromEvents, validateEventOrdering } from './reducer.js';
import { logger } from '../utils/logger.js';

/**
 * Replay all events and rebuild workflow state
 * @param {Object} options - Replay options
 * @param {number} options.fromBlock - Start block (optional)
 * @param {number} options.toBlock - End block (optional)
 * @returns {Promise<Object>} Replay statistics
 */
export async function replayAllEvents(options = {}) {
    const prisma = getPrismaClient();
    const startTime = Date.now();

    logger.info('Starting event replay', options);

    try {
        // Query all events ordered by canonical ordering
        const events = await prisma.chainEvent.findMany({
            where: {
                ...(options.fromBlock && { blockNumber: { gte: BigInt(options.fromBlock) } }),
                ...(options.toBlock && { blockNumber: { lte: BigInt(options.toBlock) } }),
            },
            orderBy: [
                { blockNumber: 'asc' },
                { transactionIndex: 'asc' },
                { logIndex: 'asc' },
            ],
        });

        logger.info(`Fetched ${events.length} events for replay`);

        if (events.length === 0) {
            logger.info('No events to replay');
            return { eventsProcessed: 0, workflowsRebuilt: 0, duration: 0 };
        }

        // Validate ordering
        if (!validateEventOrdering(events)) {
            throw new Error('Events are not properly ordered - database corruption detected');
        }

        // Group events by workflowId
        const eventsByWorkflow = new Map();
        for (const event of events) {
            if (!eventsByWorkflow.has(event.workflowId)) {
                eventsByWorkflow.set(event.workflowId, []);
            }
            eventsByWorkflow.get(event.workflowId).push(event);
        }

        logger.info(`Rebuilding ${eventsByWorkflow.size} workflows`);

        // Clear existing workflow state (we're rebuilding from scratch)
        await prisma.workflowState.deleteMany({});

        // Rebuild each workflow
        let rebuiltCount = 0;
        for (const [workflowId, workflowEvents] of eventsByWorkflow) {
            const state = reduceWorkflowFromEvents(workflowEvents);

            if (state) {
                await prisma.workflowState.upsert({
                    where: { workflowId },
                    update: {
                        status: state.status,
                        initiator: state.initiator,
                        startedAt: state.startedAt,
                        completedAt: state.completedAt,
                        failureReason: state.failureReason,
                        lastEventBlock: state.lastEventBlock,
                        lastEventLogIndex: state.lastEventLogIndex,
                    },
                    create: {
                        workflowId,
                        status: state.status,
                        initiator: state.initiator,
                        startedAt: state.startedAt,
                        completedAt: state.completedAt,
                        failureReason: state.failureReason,
                        lastEventBlock: state.lastEventBlock,
                        lastEventLogIndex: state.lastEventLogIndex,
                    },
                });

                rebuiltCount++;

                if (rebuiltCount % 100 === 0) {
                    logger.info(`Rebuilt ${rebuiltCount}/${eventsByWorkflow.size} workflows`);
                }
            }
        }

        // Update system state with last processed block
        if (events.length > 0) {
            const lastEvent = events[events.length - 1];
            await prisma.systemState.update({
                where: { id: 1 },
                data: { lastProcessedBlock: lastEvent.blockNumber },
            });
        }

        const duration = Date.now() - startTime;
        const stats = {
            eventsProcessed: events.length,
            workflowsRebuilt: rebuiltCount,
            duration,
        };

        logger.info('Event replay complete', stats);
        return stats;
    } catch (error) {
        logger.error('Event replay failed', { error: error.message, stack: error.stack });
        throw error;
    }
}

/**
 * Replay events for a single workflow
 * @param {string} workflowId - Workflow ID to replay
 * @returns {Promise<Object>} Updated workflow state
 */
export async function replayWorkflow(workflowId) {
    const prisma = getPrismaClient();

    logger.info('Replaying single workflow', { workflowId });

    try {
        // Fetch all events for this workflow
        const events = await prisma.chainEvent.findMany({
            where: { workflowId },
            orderBy: [
                { blockNumber: 'asc' },
                { transactionIndex: 'asc' },
                { logIndex: 'asc' },
            ],
        });

        if (events.length === 0) {
            logger.warn('No events found for workflow', { workflowId });
            return null;
        }

        // Validate ordering
        if (!validateEventOrdering(events)) {
            throw new Error(`Events for workflow ${workflowId} are not properly ordered`);
        }

        // Reduce to derive state
        const state = reduceWorkflowFromEvents(events);

        if (state) {
            // Update database
            await prisma.workflowState.upsert({
                where: { workflowId },
                update: {
                    status: state.status,
                    initiator: state.initiator,
                    startedAt: state.startedAt,
                    completedAt: state.completedAt,
                    failureReason: state.failureReason,
                    lastEventBlock: state.lastEventBlock,
                    lastEventLogIndex: state.lastEventLogIndex,
                },
                create: {
                    workflowId,
                    status: state.status,
                    initiator: state.initiator,
                    startedAt: state.startedAt,
                    completedAt: state.completedAt,
                    failureReason: state.failureReason,
                    lastEventBlock: state.lastEventBlock,
                    lastEventLogIndex: state.lastEventLogIndex,
                },
            });

            logger.info('Workflow replayed successfully', { workflowId, status: state.status });
        }

        return state;
    } catch (error) {
        logger.error('Workflow replay failed', {
            workflowId,
            error: error.message,
        });
        throw error;
    }
}

/**
 * Get replay progress
 * @returns {Promise<Object>} Progress information
 */
export async function getReplayProgress() {
    const prisma = getPrismaClient();

    const [systemState, eventCount, workflowCount] = await Promise.all([
        prisma.systemState.findUnique({ where: { id: 1 } }),
        prisma.chainEvent.count(),
        prisma.workflowState.count(),
    ]);

    return {
        lastProcessedBlock: systemState?.lastProcessedBlock?.toString() || '0',
        totalEvents: eventCount,
        totalWorkflows: workflowCount,
    };
}
