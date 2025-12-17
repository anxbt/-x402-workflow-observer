/**
 * Blockchain provider setup
 * Creates and exports ethers.js provider instance
 * Supports both WebSocket and HTTP JSON-RPC
 */

import { ethers } from 'ethers';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let provider = null;

export function getProvider() {
    if (provider) {
        return provider;
    }

    try {
        // Determine provider type based on RPC URL
        if (config.rpcUrl.startsWith('ws')) {
            provider = new ethers.WebSocketProvider(config.rpcUrl);
            logger.info('WebSocket provider initialized', { url: config.rpcUrl });
        } else {
            provider = new ethers.JsonRpcProvider(config.rpcUrl);
            logger.info('JSON-RPC provider initialized', { url: config.rpcUrl });
        }

        // Set up connection event handlers
        if (provider.websocket) {
            provider.websocket.on('open', () => {
                logger.info('WebSocket connection opened');
            });

            provider.websocket.on('close', (code) => {
                logger.warn('WebSocket connection closed', { code });
            });

            provider.websocket.on('error', (error) => {
                logger.error('WebSocket error', { error: error.message });
            });
        }

        return provider;
    } catch (error) {
        logger.error('Failed to initialize provider', { error: error.message });
        throw error;
    }
}

export async function getBlockNumber() {
    try {
        const p = getProvider();
        const blockNumber = await p.getBlockNumber();
        return blockNumber;
    } catch (error) {
        logger.error('Failed to get block number', { error: error.message });
        throw error;
    }
}

export async function getNetwork() {
    try {
        const p = getProvider();
        const network = await p.getNetwork();
        return {
            name: network.name,
            chainId: network.chainId.toString(),
        };
    } catch (error) {
        logger.error('Failed to get network', { error: error.message });
        throw error;
    }
}
