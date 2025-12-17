/**
 * Logger utility
 * Simple console-based logger with timestamp and level
 * In production, replace with winston or pino
 */

const LogLevel = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
};

function formatTimestamp() {
    return new Date().toISOString();
}

function log(level, message, meta = {}) {
    const timestamp = formatTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[${timestamp}] [${level}] ${message}${metaStr}`);
}

export const logger = {
    info: (message, meta) => log(LogLevel.INFO, message, meta),
    warn: (message, meta) => log(LogLevel.WARN, message, meta),
    error: (message, meta) => log(LogLevel.ERROR, message, meta),
    debug: (message, meta) => log(LogLevel.DEBUG, message, meta),
};
