/**
 * Production Logger Utility
 * Uses pino for structured logging
 * - Pretty logs in development
 * - JSON logs in production
 */
import pino from 'pino';
const isProduction = process.env.NODE_ENV === 'production';
// Create logger with appropriate transport
const logger = isProduction
    ? pino({
        level: 'info',
        formatters: {
            level: (label) => {
                return { level: label };
            },
        },
    })
    : pino({
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    });
export default logger;
