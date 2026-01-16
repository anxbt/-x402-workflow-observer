/**
 * Deterministic workflow reducer
 * Pure function that derives workflow state from events
 * 
 * CRITICAL: This function must be deterministic
 * - No Date.now() - use block timestamps only
 * - No side effects
 * - Same inputs always produce same outputs
 */

import { logger } from '../utils/logger.js';

/**
 * Apply a single event to workflow state
 * @param {Object} state - Current workflow state (or null for new workflow)
 * @param {Object} event - ChainEvent to apply
 * @returns {Object} New workflow state
 */
export function reduceWorkflow(state, event) {
    const { eventType, payload, blockNumber, logIndex, blockTimestamp } = event;

    // Initialize state for new workflow
    if (!state) {
        state = {
            workflowId: event.workflowId,
            status: 'RUNNING',
            initiator: null,
            startedAt: blockTimestamp,
            completedAt: null,
            failureReason: null,
            lastEventBlock: blockNumber,
            lastEventLogIndex: logIndex,
        };
    }

    // Apply event based on type
    switch (eventType) {
        case 'WORKFLOW_STARTED':
            return {
                ...state,
                status: 'RUNNING',
                initiator: payload.initiator,
                startedAt: blockTimestamp,
                lastEventBlock: blockNumber,
                lastEventLogIndex: logIndex,
            };

        case 'DECISION_RECORDED':
            if (payload.approved) {
                return {
                    ...state,
                    status: 'RUNNING', // Still running, awaiting settlement
                    lastEventBlock: blockNumber,
                    lastEventLogIndex: logIndex,
                };
            } else {
                return {
                    ...state,
                    status: 'REJECTED',
                    completedAt: blockTimestamp,
                    failureReason: payload.reason,
                    lastEventBlock: blockNumber,
                    lastEventLogIndex: logIndex,
                };
            }

        case 'PAYMENT_EXECUTED':
            return {
                ...state,
                status: 'RUNNING', // Still running, awaiting completion
                lastEventBlock: blockNumber,
                lastEventLogIndex: logIndex,
            };

        case 'WORKFLOW_COMPLETED':
            return {
                ...state,
                status: 'COMPLETED',
                completedAt: blockTimestamp,
                lastEventBlock: blockNumber,
                lastEventLogIndex: logIndex,
            };

        case 'WORKFLOW_FAILED':
            return {
                ...state,
                status: 'FAILED',
                completedAt: blockTimestamp,
                failureReason: payload.reason,
                lastEventBlock: blockNumber,
                lastEventLogIndex: logIndex,
            };

        default:
            logger.warn('Unknown event type in reducer', { eventType });
            return state;
    }
}

/**
 * Reduce multiple events to derive final workflow state
 * @param {Array} events - Array of ChainEvents (must be sorted)
 * @returns {Object} Final workflow state
 */
export function reduceWorkflowFromEvents(events) {
    if (!events || events.length === 0) {
        return null;
    }

    let state = null;

    for (const event of events) {
        state = reduceWorkflow(state, event);
    }

    return state;
}

/**
 * Validate event ordering
 * Ensures events are sorted by (blockNumber, txIndex, logIndex)
 * @param {Array} events - Array of events to validate
 * @returns {boolean}
 */
export function validateEventOrdering(events) {
    for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];

        if (curr.blockNumber < prev.blockNumber) {
            return false;
        }

        if (
            curr.blockNumber === prev.blockNumber &&
            curr.transactionIndex < prev.transactionIndex
        ) {
            return false;
        }

        if (
            curr.blockNumber === prev.blockNumber &&
            curr.transactionIndex === prev.transactionIndex &&
            curr.logIndex <= prev.logIndex
        ) {
            return false;
        }
    }

    return true;
}
