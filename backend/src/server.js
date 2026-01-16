/**
 * HTTP server bootstrap
 * Entry point for the application
 * 
 * Startup sequence:
 * 1. Load and validate configuration
 * 2. Connect to database
 * 3. Initialize system state
 * 4. Replay events from last checkpoint
 * 5. Initialize blockchain provider
 * 6. Start event listener
 * 7. Start HTTP server
 */

import { createApp } from './index.js';
import { config, validateConfig } from './config.js';
import { connectDatabase, disconnectDatabase, initializeSystemState, getPrismaClient } from './db/db.js';
import { replayAllEvents } from './db/replay.js';
import { startEventListener, stopEventListener } from './blockchain/listener.js';
import { getProvider, getBlockNumber, getNetwork } from './blockchain/provider.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
    try {
        logger.info('🚀 Starting x402 backend with deterministic reconstruction...');

        // Step 1: Validate configuration
        const isValid = validateConfig();
        if (!isValid) {
            throw new Error('Invalid configuration - please check .env file');
        }

        // Step 2: Connect to database
        logger.info('Connecting to database...');
        await connectDatabase();
        logger.info('✅ Database connected');

        // Step 3: Initialize system state (singleton)
        logger.info('Initializing system state...');
        await initializeSystemState();

        // Step 4: Replay events from last checkpoint
        logger.info('Starting event replay...');
        const prisma = getPrismaClient();
        const systemState = await prisma.systemState.findUnique({ where: { id: 1 } });

        const replayStats = await replayAllEvents({
            fromBlock: 0, // Replay all events for deterministic reconstruction
        });

        logger.info('✅ Event replay complete', {
            eventsProcessed: replayStats.eventsProcessed,
            workflowsRebuilt: replayStats.workflowsRebuilt,
            duration: `${replayStats.duration}ms`,
        });

        // Step 5: Initialize blockchain provider
        logger.info('Connecting to blockchain...');
        const provider = getProvider();

        // Verify connection
        const network = await getNetwork();
        const blockNumber = await getBlockNumber();

        logger.info('✅ Blockchain connected', {
            network: network.name,
            chainId: network.chainId,
            blockNumber,
            rpcUrl: config.rpcUrl,
        });

        // Step 6: Start event listener
        logger.info('Starting event listener...');
        startEventListener();
        logger.info('✅ Event listener started', {
            confirmationBlocks: config.confirmationBlocks,
        });

        // Step 7: Create and start HTTP server
        const app = createApp();

        const server = app.listen(config.port, () => {
            logger.info('✅ Server ready', {
                port: config.port,
                environment: config.nodeEnv,
                contractAddress: config.contractAddress,
            });

            logger.info('📡 API Endpoints:');
            logger.info(`   Health:     http://localhost:${config.port}/health`);
            logger.info(`   DB Health:  http://localhost:${config.port}/health/db`);
            logger.info(`   Workflows:  http://localhost:${config.port}/workflows`);
            logger.info(`   Stats:      http://localhost:${config.port}/stats`);
        });

        // Return server for testing
        return server;

    } catch (error) {
        logger.error('❌ Failed to start server', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
}

// Graceful shutdown
async function shutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
        // Stop event listener
        stopEventListener();

        // Disconnect from database
        await disconnectDatabase();

        logger.info('✅ Shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the server
bootstrap();
