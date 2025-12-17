/**
 * HTTP server bootstrap
 * Entry point for the application
 * 
 * Startup sequence:
 * 1. Load configuration
 * 2. Initialize blockchain provider
 * 3. Start event listener
 * 4. Start HTTP server
 */

import { createApp } from './index.js';
import { config, validateConfig } from './config.js';
import { startEventListener } from './blockchain/listener.js';
import { getProvider, getBlockNumber, getNetwork } from './blockchain/provider.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
    try {
        logger.info('🚀 Starting x402 backend...');

        // Validate configuration
        validateConfig();

        // Initialize blockchain provider
        logger.info('Connecting to blockchain...');
        const provider = getProvider();

        // Verify connection
        const network = await getNetwork();
        const blockNumber = await getBlockNumber();

        logger.info('Blockchain connected', {
            network: network.name,
            chainId: network.chainId,
            blockNumber,
        });

        // Start event listener
        logger.info('Starting event listener...');
        startEventListener();

        // Create and start HTTP server
        const app = createApp();

        app.listen(config.port, () => {
            logger.info('✅ Server ready', {
                port: config.port,
                environment: config.nodeEnv,
                contractAddress: config.contractAddress,
            });

            logger.info(`API available at http://localhost:${config.port}`);
            logger.info(`Health check: http://localhost:${config.port}/health`);
        });

    } catch (error) {
        logger.error('Failed to start server', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the server
bootstrap();
