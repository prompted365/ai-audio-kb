/**
 * AI Audio KB - MongoDB Atlas Database Configuration
 * 
 * Production-ready MongoDB connection with Atlas Vector Search support,
 * connection pooling, retry logic, and comprehensive error handling.
 */

import { MongoClient, ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  /**
   * Initialize MongoDB Atlas connection
   */
  async connect() {
    if (this.isConnected) {
      logger.info('Database already connected');
      return this.db;
    }

    if (this.isConnecting) {
      logger.info('Database connection already in progress');
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (this.isConnected) {
            clearInterval(checkConnection);
            resolve(this.db);
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    try {
      logger.info('Connecting to MongoDB Atlas...', {
        database: config.MONGODB_DB_NAME,
        poolSize: config.MONGODB_POOL_SIZE
      });

      // MongoDB client options
      const clientOptions = {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        maxPoolSize: parseInt(config.MONGODB_POOL_SIZE) || 20,
        minPoolSize: 5,
        maxIdleTimeMS: parseInt(config.MONGODB_MAX_IDLE_TIME) || 30000,
        serverSelectionTimeoutMS: parseInt(config.MONGODB_SERVER_SELECTION_TIMEOUT) || 5000,
        socketTimeoutMS: parseInt(config.MONGODB_SOCKET_TIMEOUT) || 45000,
        retryWrites: true,
        retryReads: true,
        w: 'majority',
        readPreference: 'primaryPreferred',
        compressors: ['snappy', 'zlib'],
        zlibCompressionLevel: 6,
      };

      // Create MongoDB client
      this.client = new MongoClient(config.MONGODB_URI, clientOptions);
      
      // Connect to MongoDB
      await this.client.connect();
      
      // Verify connection with admin ping
      await this.client.db('admin').command({ ping: 1 });
      
      // Get database instance
      this.db = this.client.db(config.MONGODB_DB_NAME);
      
      // Setup connection event handlers
      this.setupEventHandlers();
      
      // Initialize collections and indexes
      await this.initializeCollections();
      
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      logger.info('MongoDB Atlas connection established', {
        database: config.MONGODB_DB_NAME,
        host: this.client.options.hosts?.[0],
        poolSize: clientOptions.maxPoolSize
      });

      return this.db;

    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;

      logger.error('MongoDB connection failed', {
        error: error.message,
        stack: error.stack,
        attempts: this.reconnectAttempts + 1
      });

      // Retry connection if not at max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Retrying MongoDB connection in ${this.reconnectDelay}ms`, {
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts
        });
        
        setTimeout(() => {
          this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
        
        return null;
      }

      throw new Error(`Failed to connect to MongoDB after ${this.maxReconnectAttempts} attempts: ${error.message}`);
    }
  }

  /**
   * Setup MongoDB connection event handlers
   */
  setupEventHandlers() {
    if (!this.client) return;

    this.client.on('open', () => {
      logger.info('MongoDB connection opened');
      this.isConnected = true;
    });

    this.client.on('close', () => {
      logger.warn('MongoDB connection closed');
      this.isConnected = false;
    });

    this.client.on('error', (error) => {
      logger.error('MongoDB connection error', {
        error: error.message,
        stack: error.stack
      });
      this.isConnected = false;
    });

    this.client.on('timeout', () => {
      logger.warn('MongoDB connection timeout');
    });

    this.client.on('reconnect', () => {
      logger.info('MongoDB reconnected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });
  }

  /**
   * Initialize collections and create indexes
   */
  async initializeCollections() {
    try {
      logger.info('Initializing MongoDB collections and indexes...');

      // Create collections if they don't exist
      const collections = ['audio_events', 'audit_logs', 'users', 'sessions'];
      
      for (const collectionName of collections) {
        const exists = await this.db.listCollections({ name: collectionName }).hasNext();
        if (!exists) {
          await this.db.createCollection(collectionName);
          logger.info(`Created collection: ${collectionName}`);
        }
      }

      // Create indexes for audio_events collection
      const audioEvents = this.db.collection('audio_events');
      
      await audioEvents.createIndexes([
        // Primary indexes for queries
        { key: { event_id: 1 }, unique: true },
        { key: { tenant_id: 1, created_at: -1 } },
        { key: { session_id: 1, 'segment.idx': 1 } },
        
        // Search indexes
        { key: { tags: 1 } },
        { key: { 'transcript.language': 1 } },
        { key: { 'consent.region': 1 } },
        { key: { 'device.model': 1 } },
        
        // Compound indexes for common queries
        { key: { tenant_id: 1, 'consent.region': 1, created_at: -1 } },
        { key: { tenant_id: 1, tags: 1, created_at: -1 } }
      ]);

      // Create Vector Search Index (Atlas-specific)
      try {
        // Note: Vector search indexes must be created via Atlas UI or CLI
        // This is a placeholder for documentation
        logger.info('Vector search index creation should be done via Atlas UI', {
          collection: 'audio_events',
          field: 'embedding',
          dimensions: 768,
          similarity: 'cosine',
          indexName: 'audio_embeddings_index'
        });
      } catch (vectorError) {
        logger.warn('Vector search index creation skipped', {
          reason: 'Must be created via Atlas UI',
          error: vectorError.message
        });
      }

      // Create indexes for audit_logs collection
      const auditLogs = this.db.collection('audit_logs');
      
      await auditLogs.createIndexes([
        { key: { timestamp: -1 } },
        { key: { actor: 1, timestamp: -1 } },
        { key: { action: 1, timestamp: -1 } },
        { key: { subject: 1, timestamp: -1 } },
        
        // TTL index for log retention (90 days default)
        { 
          key: { timestamp: 1 }, 
          expireAfterSeconds: parseInt(config.AUDIT_LOG_RETENTION_DAYS) * 24 * 60 * 60 
        }
      ]);

      // Create indexes for users collection
      const users = this.db.collection('users');
      
      await users.createIndexes([
        { key: { email: 1 }, unique: true },
        { key: { tenant_id: 1 } },
        { key: { api_key_hash: 1 }, sparse: true },
        { key: { created_at: -1 } }
      ]);

      // Create indexes for sessions collection
      const sessions = this.db.collection('sessions');
      
      await sessions.createIndexes([
        { key: { session_id: 1 }, unique: true },
        { key: { user_id: 1, created_at: -1 } },
        { key: { tenant_id: 1, created_at: -1 } },
        { key: { status: 1, updated_at: -1 } },
        
        // TTL index for session cleanup (30 days)
        { key: { updated_at: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 }
      ]);

      logger.info('MongoDB collections and indexes initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize MongoDB collections', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Initialize Mongoose connection (for ODM if needed)
   */
  async connectMongoose() {
    try {
      logger.info('Initializing Mongoose connection...');

      const mongooseOptions = {
        maxPoolSize: parseInt(config.MONGODB_POOL_SIZE) || 20,
        serverSelectionTimeoutMS: parseInt(config.MONGODB_SERVER_SELECTION_TIMEOUT) || 5000,
        socketTimeoutMS: parseInt(config.MONGODB_SOCKET_TIMEOUT) || 45000,
        retryWrites: true,
        retryReads: true,
        w: 'majority'
      };

      await mongoose.connect(config.MONGODB_URI, mongooseOptions);
      
      logger.info('Mongoose connection established');
      
      return mongoose.connection;

    } catch (error) {
      logger.error('Mongoose connection failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDatabase() {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get collection with error handling
   */
  getCollection(name) {
    const db = this.getDatabase();
    return db.collection(name);
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      if (!this.isConnected || !this.client) {
        return {
          status: 'unhealthy',
          message: 'Not connected to database'
        };
      }

      // Perform a simple ping
      const start = Date.now();
      await this.client.db('admin').command({ ping: 1 });
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        database: config.MONGODB_DB_NAME,
        response_time_ms: duration,
        pool_size: this.client.options?.maxPoolSize,
        connected: this.isConnected
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        connected: false
      };
    }
  }

  /**
   * Gracefully close database connection
   */
  async disconnect() {
    try {
      logger.info('Closing MongoDB connection...');

      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        logger.info('Mongoose connection closed');
      }

      if (this.client && this.isConnected) {
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        this.db = null;
        logger.info('MongoDB connection closed');
      }

    } catch (error) {
      logger.error('Error closing MongoDB connection', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Export database manager and convenience methods
export { databaseManager as database };
export const connectDatabase = () => databaseManager.connect();
export const getDatabase = () => databaseManager.getDatabase();
export const getCollection = (name) => databaseManager.getCollection(name);
export const disconnectDatabase = () => databaseManager.disconnect();
export const databaseHealthCheck = () => databaseManager.healthCheck();

export default databaseManager;
