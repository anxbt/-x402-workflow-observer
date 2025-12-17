/**
 * Workflow API routes
 * Read-only endpoints for querying workflow state
 * 
 * All endpoints are GET only - no mutations
 */

import express from 'express';
import { memoryStore } from '../store/memoryStore.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /health
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// GET /workflows
// Returns list of all workflows with basic info
router.get('/workflows', (req, res) => {
    try {
        const workflows = memoryStore.getAllWorkflows();

        const response = workflows.map(wf => ({
            workflowId: wf.workflowId,
            status: wf.status,
            initiator: wf.initiator,
            startedAt: wf.startedAt,
            completedAt: wf.completedAt,
        }));

        res.json(response);
    } catch (error) {
        logger.error('Error fetching workflows', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /workflows/:id
// Returns detailed workflow information including decisions and settlements
router.get('/workflows/:id', (req, res) => {
    try {
        const { id } = req.params;

        const workflow = memoryStore.getWorkflow(id);

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const decisions = memoryStore.getDecisions(id);
        const settlements = memoryStore.getSettlements(id);

        const response = {
            workflow,
            decisions,
            settlements,
        };

        res.json(response);
    } catch (error) {
        logger.error('Error fetching workflow details', {
            workflowId: req.params.id,
            error: error.message,
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /stats
// Returns aggregated statistics
router.get('/stats', (req, res) => {
    try {
        const stats = memoryStore.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching stats', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
