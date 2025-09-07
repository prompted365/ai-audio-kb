/**
 * AI Audio KB - Structured Logger
 * 
 * Winston-based logging configuration with multiple transports,
 * structured JSON output, and environment-aware log levels.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels for different environments
const LOG_LEVELS = {
  development: 'debug',
  test: 'warn',
  production: 'info'
};

// Custom format for console output in development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ` ${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// JSON format for file output and production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports array
const transports = [];

// Console transport (always enabled in development, optional in production)
const shouldLogToConsole = process.env.LOG_CONSOLE_ENABLED !== 'false' || 
                          process.env.NODE_ENV === 'development';

if (shouldLogToConsole) {
  transports.push(
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || LOG_LEVELS[process.env.NODE_ENV] || 'info',
      format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

// File transport (optional, controlled by LOG_FILE_ENABLED)
if (process.env.LOG_FILE_ENABLED !== 'false') {
  const logDir = path.dirname(process.env.LOG_FILE_PATH || './logs/app.log');
  
  // Ensure log directory exists
  import('fs').then(fs => {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  });

  // Daily rotating file transport
  transports.push(
    new DailyRotateFile({
      filename: process.env.LOG_FILE_PATH || './logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '10mb',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '5',
      level: process.env.LOG_LEVEL || LOG_LEVELS[process.env.NODE_ENV] || 'info',
      format: jsonFormat,
      handleExceptions: true,
      handleRejections: true,
      auditFile: './logs/.audit.json'
    })
  );

  // Separate error log file
  transports.push(
    new DailyRotateFile({
      filename: './logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '10mb',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '5',
      level: 'error',
      format: jsonFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || LOG_LEVELS[process.env.NODE_ENV] || 'info',
  format: jsonFormat,
  defaultMeta: {
    service: 'ai-audio-kb-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  },
  transports,
  exitOnError: false
});

// Add custom logging methods for audio-specific events
logger.audioEvent = (event, metadata = {}) => {
  logger.info(`Audio Event: ${event}`, {
    category: 'audio',
    event,
    ...metadata
  });
};

logger.asrEvent = (event, metadata = {}) => {
  logger.info(`ASR Event: ${event}`, {
    category: 'asr',
    event,
    ...metadata
  });
};

logger.vectorEvent = (event, metadata = {}) => {
  logger.info(`Vector Event: ${event}`, {
    category: 'vector',
    event,
    ...metadata
  });
};

logger.agentEvent = (event, metadata = {}) => {
  logger.info(`Agent Event: ${event}`, {
    category: 'agent',
    event,
    ...metadata
  });
};

logger.securityEvent = (event, metadata = {}) => {
  logger.warn(`Security Event: ${event}`, {
    category: 'security',
    event,
    ...metadata
  });
};

logger.performanceEvent = (event, metadata = {}) => {
  logger.info(`Performance Event: ${event}`, {
    category: 'performance',
    event,
    ...metadata
  });
};

logger.costEvent = (event, metadata = {}) => {
  logger.info(`Cost Event: ${event}`, {
    category: 'cost',
    event,
    ...metadata
  });
};

// Performance timing utility
logger.timeStart = (operation) => {
  const startTime = process.hrtime.bigint();
  return {
    end: (metadata = {}) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      logger.performanceEvent(`${operation} completed`, {
        operation,
        duration_ms: duration,
        ...metadata
      });
      
      return duration;
    }
  };
};

// Request logging utility
logger.requestLogger = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] || 
                   req.headers['x-correlation-id'] || 
                   Math.random().toString(36).substring(2, 15);
  
  // Add request ID to all subsequent logs
  req.requestId = requestId;
  req.logger = logger.child({ requestId });

  req.logger.info('HTTP Request Started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentLength: req.get('Content-Length'),
    contentType: req.get('Content-Type')
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    req.logger.info('HTTP Request Completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration_ms: duration,
      contentLength: res.get('Content-Length')
    });
    
    originalEnd.apply(this, args);
  };

  next();
};

// Error logging with context
logger.logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    ...context
  };

  if (error.statusCode && error.statusCode < 500) {
    logger.warn('Client Error', errorInfo);
  } else {
    logger.error('Server Error', errorInfo);
  }
};

// Health check logging
logger.healthCheck = (status, checks = {}) => {
  logger.info('Health Check', {
    category: 'health',
    status,
    checks,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
};

// Startup logging
logger.startup = (component, metadata = {}) => {
  logger.info(`${component} started`, {
    category: 'startup',
    component,
    ...metadata
  });
};

// Shutdown logging
logger.shutdown = (component, metadata = {}) => {
  logger.info(`${component} shutting down`, {
    category: 'shutdown',
    component,
    ...metadata
  });
};

// Export logger as default and named export
export default logger;
