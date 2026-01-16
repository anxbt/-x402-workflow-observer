/**
 * Database client module
 * Exports singleton Prisma client instance
 * Handles connection lifecycle and health checks
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// Singleton Prisma client
let prisma = null;
let pool = null;

/**
 * Get or create Prisma client instance
 * @returns {PrismaClient}
 */
export function getPrismaClient() {
    if (!prisma) {
        // Prisma 7 requires adapter for PostgreSQL
        const { Pool } = pg;
        pool = new Pool({ connectionString: config.databaseUrl });
        const adapter = new PrismaPg(pool);

        prisma = new PrismaClient({
            adapter,
            log: [
                { level: 'warn', emit: 'event' },
                { level: 'error', emit: 'event' },
            ],
        });

        // Log warnings and errors
        prisma.$on('warn', (e) => {
            logger.warn('Prisma warning', { message: e.message });
        });

        prisma.$on('error', (e) => {
            logger.error('Prisma error', { message: e.message });
        });

        logger.info('Prisma client initialized');
    }

    return prisma;
}

/**
 * Connect to database
 */
export async function connectDatabase() {
    const client = getPrismaClient();

    try {
        await client.$connect();
        logger.info('Database connected successfully');
        return true;
    } catch (error) {
        logger.error('Failed to connect to database', { error: error.message });
        throw error;
    }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase() {
    if (prisma) {
        await prisma.$disconnect();
        logger.info('Database disconnected');
        prisma = null;
    }

    if (pool) {
        await pool.end();
        logger.info('Connection pool closed');
        pool = null;
    }
}

/**
 * Health check - performs simple query
 * @returns {Promise<boolean>}
 */
export async function checkDatabaseHealth() {
    const client = getPrismaClient();

    try {
        // Simple query to check connection
        await client.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
        logger.error('Database health check failed', { error: error.message });
        return false;
    }
}

/**
 * Initialize system state if not exists
 */
export async function initializeSystemState() {
    const client = getPrismaClient();

    try {
        // Upsert system state (singleton)
        await client.systemState.upsert({
            where: { id: 1 },
            update: {},
            create: {
                id: 1,
                lastProcessedBlock: BigInt(0),
                confirmationBlocks: 3,
            },
        });

        logger.info('System state initialized');
    } catch (error) {
        logger.error('Failed to initialize system state', { error: error.message });
        throw error;
    }
}
