/**
 * In-memory data store
 * Uses JavaScript Map for O(1) lookups
 * NOTE: This is ephemeral - data is lost on restart
 * 
 * In production, replace with:
 * - PostgreSQL for relational queries
 * - Redis for caching
 * - MongoDB for flexible schema
 */

import { WorkflowStatus } from '../config.js';
import { logger } from '../utils/logger.js';

class MemoryStore {
    constructor() {
        // Map<workflowId, Workflow>
        this.workflows = new Map();

        // Map<workflowId, Decision[]>
        this.decisions = new Map();

        // Map<workflowId, Settlement[]>
        this.settlements = new Map();

        logger.info('MemoryStore initialized');
    }

    // ============ Workflow Methods ============

    createWorkflow(workflowId, initiator, timestamp) {
        const workflow = {
            workflowId,
            initiator,
            status: WorkflowStatus.RUNNING,
            startedAt: timestamp,
            completedAt: null,
            failureReason: null,
        };

        this.workflows.set(workflowId, workflow);
        this.decisions.set(workflowId, []);
        this.settlements.set(workflowId, []);

        logger.info('Workflow created', { workflowId, initiator });
        return workflow;
    }

    getWorkflow(workflowId) {
        return this.workflows.get(workflowId);
    }

    getAllWorkflows() {
        return Array.from(this.workflows.values());
    }

    updateWorkflowStatus(workflowId, status, completedAt = null, failureReason = null) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            logger.warn('Workflow not found for status update', { workflowId });
            return null;
        }

        workflow.status = status;

        if (completedAt) {
            workflow.completedAt = completedAt;
        }

        if (failureReason) {
            workflow.failureReason = failureReason;
        }

        this.workflows.set(workflowId, workflow);
        logger.info('Workflow status updated', { workflowId, status });
        return workflow;
    }

    // ============ Decision Methods ============

    addDecision(workflowId, approved, reason) {
        const decision = {
            approved,
            reason,
            timestamp: Date.now(),
        };

        const decisions = this.decisions.get(workflowId) || [];
        decisions.push(decision);
        this.decisions.set(workflowId, decisions);

        logger.info('Decision recorded', { workflowId, approved });
        return decision;
    }

    getDecisions(workflowId) {
        return this.decisions.get(workflowId) || [];
    }

    // ============ Settlement Methods ============

    addSettlement(workflowId, from, to, amount) {
        const settlement = {
            from,
            to,
            amount: amount.toString(), // Store as string to avoid precision loss
            timestamp: Date.now(),
        };

        const settlements = this.settlements.get(workflowId) || [];
        settlements.push(settlement);
        this.settlements.set(workflowId, settlements);

        logger.info('Settlement recorded', { workflowId, from, to, amount: settlement.amount });
        return settlement;
    }

    getSettlements(workflowId) {
        return this.settlements.get(workflowId) || [];
    }

    // ============ Stats Methods ============

    getStats() {
        const workflows = this.getAllWorkflows();

        return {
            total: workflows.length,
            running: workflows.filter(w => w.status === WorkflowStatus.RUNNING).length,
            completed: workflows.filter(w => w.status === WorkflowStatus.COMPLETED).length,
            failed: workflows.filter(w => w.status === WorkflowStatus.FAILED).length,
        };
    }

    // ============ Utility Methods ============

    clear() {
        this.workflows.clear();
        this.decisions.clear();
        this.settlements.clear();
        logger.info('MemoryStore cleared');
    }

    size() {
        return {
            workflows: this.workflows.size,
            decisions: this.decisions.size,
            settlements: this.settlements.size,
        };
    }
}

// Singleton instance
export const memoryStore = new MemoryStore();
