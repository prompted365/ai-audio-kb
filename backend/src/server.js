#!/usr/bin/env node

/**
 * AI Audio KB Backend Server
 * 
 * Production-grade Node.js server for audio ingestion, processing, and AI integration.
 * Supports WebSocket streaming, batch uploads, and comprehensive observability.
 */

import 'dotenv/config';
import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Internal imports
import { logger } from './utils/logger.js';
import { config } from './config/index.js';
import { database } from './config/database.js';
import { redisClient } from './config/redis.js';
import { metrics } from './middleware/metrics.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authentication } from './middleware/auth.js';
import { regionValidator } from './middleware/regionValidator.js';

// Routes
import healthRoutes from './routes/health.js';
import audioRoutes from './routes/audio.js';
import transcriptionRoutes from './routes/transcription.js';
import searchRoutes from './routes/search.js';
import agentRoutes from './routes/agents.js';

// Services
import { AudioStreamService } from './services/AudioStreamService.js';
import { TranscriptionService } from './services/TranscriptionService.js';
import { VectorService } from './services/VectorService.js';
import { ConsentService } from './services/ConsentService.js';

// WebSocket handlers
import { setupWebSocketHandlers } from './websocket/index.js';

class AIAudioKBServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.CORS_ORIGINS || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      maxHttpBufferSize: config.WS_MAX_BUFFER_SIZE
    });
    
    this.port = config.PORT || 3000;
    this.host = config.HOST || 'localhost';
  }

  /**
   * Configure Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-region', 'x-consent-hash']
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      message: {
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Metrics collection
    this.app.use(metrics);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Public routes (no authentication required)
    this.app.use('/api/v1/health', healthRoutes);
    
    // Protected routes (require authentication + region validation)
    this.app.use('/api/v1', authentication);
    this.app.use('/api/v1', regionValidator);
    
    this.app.use('/api/v1/audio', audioRoutes);
    this.app.use('/api/v1/transcription', transcriptionRoutes);
    this.app.use('/api/v1/search', searchRoutes);
    this.app.use('/api/v1/agents', agentRoutes);

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', (req, res) => {
      res.set('Content-Type', metrics.register.contentType);
      res.end(metrics.register.metrics());
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  /**
   * Setup WebSocket handlers
   */
  setupWebSocket() {
    setupWebSocketHandlers(this.io);
    
    this.io.on('connection', (socket) => {
      logger.info('WebSocket connection established', {
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      });

      socket.on('disconnect', (reason) => {
        logger.info('WebSocket disconnected', {
          socketId: socket.id,
          reason
        });
      });
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use(errorHandler);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason?.toString(),
        stack: reason?.stack,
        promise: promise?.toString()
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        message: error.message,
        stack: error.stack
      });
      
      // Graceful shutdown
      this.gracefulShutdown();
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown');
      this.gracefulShutdown();
    });
  }

  /**
   * Initialize database connections and services
   */
  async initializeServices() {
    try {
      logger.info('Initializing database connection...');
      await database.migrate.latest();
      logger.info('Database migrations completed');

      logger.info('Initializing Redis connection...');
      await redisClient.ping();
      logger.info('Redis connection established');

      logger.info('Initializing AI services...');
      // Initialize services that might need async setup
      await TranscriptionService.initialize();
      await VectorService.initialize();
      await ConsentService.initialize();
      
      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown handler
   */
  async gracefulShutdown() {
    logger.info('Starting graceful shutdown...');
    
    try {
      // Close server
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close WebSocket connections
      this.io.close(() => {
        logger.info('WebSocket server closed');
      });

      // Close database connections
      if (database) {
        await database.destroy();
        logger.info('Database connections closed');
      }

      // Close Redis connection
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed');
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Initialize services
      await this.initializeServices();

      // Setup middleware and routes
      this.setupMiddleware();
      this.setupRoutes();
      this.setupWebSocket();
      this.setupErrorHandling();

      // Start listening
      this.server.listen(this.port, this.host, () => {
        logger.info('AI Audio KB Server started', {
          port: this.port,
          host: this.host,
          env: config.NODE_ENV,
          version: process.env.npm_package_version,
          nodeVersion: process.version,
          pid: process.pid
        });

        // Health check log
        logger.info('Server health check', {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      });

    } catch (error) {
      logger.error('Failed to start server', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new AIAudioKBServer();
  server.start();
}

export default AIAudioKBServer;
