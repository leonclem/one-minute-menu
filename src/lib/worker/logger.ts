/**
 * Structured logging for Railway workers
 * 
 * Provides Winston-based logging with:
 * - JSON formatting for structured logs
 * - Timestamp and error stack traces
 * - Worker ID in all log entries
 * - Console and file transports
 */

import winston from 'winston';

// Log levels: error, warn, info, debug
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const WORKER_ID = process.env.WORKER_ID || 'unknown';

/**
 * Create Winston logger instance with structured formatting
 */
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'railway-worker',
    worker_id: WORKER_ID
  },
  transports: [
    // Console output for Railway logs
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 
            ? JSON.stringify(meta, null, 2) 
            : '';
          return `${timestamp} [${level}] ${message} ${metaStr}`;
        })
      )
    }),
    
    // Error log file
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Combined log file
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

/**
 * Log job lifecycle events
 */
export const logJobEvent = {
  claimed: (jobId: string, exportType: string, priority: number, retryCount: number) => {
    logger.info('Job claimed', {
      job_id: jobId,
      export_type: exportType,
      priority,
      retry_count: retryCount,
      event: 'job_claimed'
    });
  },

  started: (jobId: string, exportType: string) => {
    logger.info('Job processing started', {
      job_id: jobId,
      export_type: exportType,
      event: 'job_started'
    });
  },

  completed: (jobId: string, exportType: string, durationMs: number, fileSize: number, fileUrl: string) => {
    logger.info('Job completed successfully', {
      job_id: jobId,
      export_type: exportType,
      duration_ms: durationMs,
      file_size_bytes: fileSize,
      file_url: fileUrl,
      event: 'job_completed'
    });
  },

  failed: (jobId: string, exportType: string, errorCategory: string, errorMessage: string, retryCount: number, willRetry: boolean) => {
    logger.error('Job failed', {
      job_id: jobId,
      export_type: exportType,
      error_category: errorCategory,
      error_message: errorMessage,
      retry_count: retryCount,
      will_retry: willRetry,
      event: 'job_failed'
    });
  },

  retrying: (jobId: string, retryCount: number, retryDelayMs: number) => {
    logger.info('Job queued for retry', {
      job_id: jobId,
      retry_count: retryCount,
      retry_delay_ms: retryDelayMs,
      event: 'job_retry'
    });
  },

  terminalFailure: (jobId: string, exportType: string, errorMessage: string, retryCount: number) => {
    logger.error('Job failed permanently', {
      job_id: jobId,
      export_type: exportType,
      error_message: errorMessage,
      retry_count: retryCount,
      event: 'job_terminal_failure'
    });
  }
};

/**
 * Log worker lifecycle events
 */
export const logWorkerEvent = {
  startup: () => {
    logger.info('Worker starting up', {
      worker_id: WORKER_ID,
      node_version: process.version,
      event: 'worker_startup'
    });
  },

  ready: () => {
    logger.info('Worker ready to process jobs', {
      worker_id: WORKER_ID,
      event: 'worker_ready'
    });
  },

  shutdown: (reason: string) => {
    logger.info('Worker shutting down', {
      worker_id: WORKER_ID,
      reason,
      event: 'worker_shutdown'
    });
  },

  shutdownComplete: () => {
    logger.info('Worker shutdown complete', {
      worker_id: WORKER_ID,
      event: 'worker_shutdown_complete'
    });
  },

  shutdownTimeout: (jobId: string) => {
    logger.warn('Shutdown timeout exceeded, job will be recovered by stale detection', {
      worker_id: WORKER_ID,
      job_id: jobId,
      event: 'worker_shutdown_timeout'
    });
  }
};

/**
 * Log error details with stack traces
 */
export const logError = (context: string, error: Error, metadata?: Record<string, any>) => {
  logger.error(`Error in ${context}`, {
    error_message: error.message,
    error_stack: error.stack,
    ...metadata,
    event: 'error'
  });
};

/**
 * Log warning messages
 */
export const logWarning = (message: string, metadata?: Record<string, any>) => {
  logger.warn(message, {
    ...metadata,
    event: 'warning'
  });
};

/**
 * Log info messages
 */
export const logInfo = (message: string, metadata?: Record<string, any>) => {
  logger.info(message, {
    ...metadata,
    event: 'info'
  });
};

/**
 * Log debug messages
 */
export const logDebug = (message: string, metadata?: Record<string, any>) => {
  logger.debug(message, {
    ...metadata,
    event: 'debug'
  });
};
