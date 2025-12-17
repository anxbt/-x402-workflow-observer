/**
 * Configuration module
 * Loads and validates environment variables
 * Provides constants used throughout the application
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Blockchain configuration
  rpcUrl: process.env.RPC_URL || 'wss://eth-sepolia.g.alchemy.com/v2/demo',
  chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
  
  // Contract configuration
  contractAddress: process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
  blockStart: parseInt(process.env.BLOCK_START || '0', 10),
};

// Workflow status constants
export const WorkflowStatus = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// Validate required configuration
export function validateConfig() {
  const required = ['rpcUrl', 'contractAddress'];
  const missing = required.filter(key => !config[key] || config[key] === '0x0000000000000000000000000000000000000000');
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing configuration: ${missing.join(', ')}`);
    console.warn('⚠️  Using default values - update .env for production');
  }
  
  return missing.length === 0;
}
