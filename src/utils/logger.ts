/**
 * Winston logger configuration with daily rotation
 */
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logsDir = process.env.LOGS_DIR || 'logs';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Daily rotate file transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
});

// Daily rotate file transport for error logs
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
});

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    allLogsTransport,
    errorLogsTransport,
  ],
  exitOnError: false,
});

/**
 * Log bot command
 */
export function logCommand(userId: number, command: string, success: boolean = true) {
  logger.info('Bot command', {
    userId,
    command,
    success,
    type: 'command',
  });
}

/**
 * Log post action
 */
export function logPostAction(action: string, postId: number, userId: number, details?: any) {
  logger.info('Post action', {
    action,
    postId,
    userId,
    details,
    type: 'post_action',
  });
}

/**
 * Log error with context
 */
export function logError(error: Error, context?: any) {
  logger.error('Application error', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    context,
    type: 'error',
  });
}

/**
 * Log scheduler action
 */
export function logScheduler(action: string, details?: any) {
  logger.info('Scheduler action', {
    action,
    details,
    type: 'scheduler',
  });
}

export default logger;
