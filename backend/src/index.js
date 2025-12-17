/**
 * Express application setup
 * Configures middleware and routes
 * Does NOT start the HTTP server - see server.js
 */

import express from 'express';
import cors from 'cors';
import workflowRoutes from './routes/workflows.js';
import { logger } from './utils/logger.js';

export function createApp() {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Request logging middleware
    app.use((req, res, next) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info('HTTP Request', {
                method: req.method,
                path: req.path,
                status: res.statusCode,
                duration: `${duration}ms`,
            });
        });

        next();
    });

    // Routes
    app.use('/', workflowRoutes);

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    app.use((err, req, res, next) => {
        logger.error('Unhandled error', {
            error: err.message,
            stack: err.stack,
        });

        res.status(500).json({ error: 'Internal server error' });
    });

    return app;
}
