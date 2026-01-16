/**
 * Workflow API routes
 * Read-only endpoints for querying workflow state from database
 * 
 * All endpoints are GET only - no mutations
 */

import express from 'express';
import { getPrismaClient, checkDatabaseHealth } from '../db/db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /health
// Basic health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// GET /health/db
// Database health check endpoint
router.get('/health/db', async (req, res) => {
    try {
        const isHealthy = await checkDatabaseHealth();

        if (isHealthy) {
            res.json({ status: 'ok', db: 'connected' });
        } else {
            res.status(500).json({ status: 'error', db: 'disconnected' });
        }
    } catch (error) {
        logger.error('Database health check failed', { error: error.message });
        res.status(500).json({ status: 'error', db: 'disconnected', error: error.message });
    }
});

// GET /workflows
// Returns list of all workflows with basic info (paginated)
router.get('/workflows', async (req, res) => {
    try {
        const prisma = getPrismaClient();

        // Pagination parameters
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const workflows = await prisma.workflowState.findMany({
            orderBy: { startedAt: 'desc' },
            take: limit,
            skip: offset,
        });

        // Convert BigInt to string for JSON serialization
        const response = workflows.map(wf => ({
            workflowId: wf.workflowId,
            status: wf.status.toLowerCase(), // Convert enum to lowercase for frontend compatibility
            initiator: wf.initiator,
            startedAt: Number(wf.startedAt),
            completedAt: wf.completedAt ? Number(wf.completedAt) : null,
        }));

        res.json(response);
    } catch (error) {
        logger.error('Error fetching workflows', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /workflows/:id
// Returns detailed workflow information including event timeline
router.get('/workflows/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const prisma = getPrismaClient();

        // Fetch workflow state
        const workflow = await prisma.workflowState.findUnique({
            where: { workflowId: id },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Fetch all events for this workflow (ordered)
        const events = await prisma.chainEvent.findMany({
            where: { workflowId: id },
            orderBy: [
                { blockNumber: 'asc' },
                { transactionIndex: 'asc' },
                { logIndex: 'asc' },
            ],
        });

        // Transform events into decisions and settlements for frontend compatibility
        const decisions = [];
        const settlements = [];

        for (const event of events) {
            if (event.eventType === 'DECISION_RECORDED') {
                decisions.push({
                    approved: event.payload.approved,
                    reason: event.payload.reason,
                    timestamp: Number(event.blockTimestamp),
                });
            } else if (event.eventType === 'PAYMENT_EXECUTED') {
                settlements.push({
                    from: workflow.initiator, // Approximation
                    to: event.payload.to,
                    amount: event.payload.amount,
                    timestamp: Number(event.blockTimestamp),
                });
            }
        }

        // Convert BigInt to Number for JSON serialization
        const response = {
            workflow: {
                workflowId: workflow.workflowId,
                status: workflow.status.toLowerCase(),
                initiator: workflow.initiator,
                startedAt: Number(workflow.startedAt),
                completedAt: workflow.completedAt ? Number(workflow.completedAt) : null,
                failureReason: workflow.failureReason,
            },
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
router.get('/stats', async (req, res) => {
    try {
        const prisma = getPrismaClient();

        // Aggregate counts by status
        const [total, running, completed, failed, rejected] = await Promise.all([
            prisma.workflowState.count(),
            prisma.workflowState.count({ where: { status: 'RUNNING' } }),
            prisma.workflowState.count({ where: { status: 'COMPLETED' } }),
            prisma.workflowState.count({ where: { status: 'FAILED' } }),
            prisma.workflowState.count({ where: { status: 'REJECTED' } }),
        ]);

        res.json({
            total,
            running,
            completed,
            failed: failed + rejected, // Combine failed and rejected for frontend
        });
    } catch (error) {
        logger.error('Error fetching stats', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
