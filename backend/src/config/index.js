/**
 * AI Audio KB - Configuration Manager
 * 
 * Centralized configuration management with environment variable validation,
 * type coercion, and comprehensive default values.
 */

import 'dotenv/config';
import { logger } from '../utils/logger.js';

/**
 * Parse environment variable as boolean
 */
function parseBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse environment variable as integer
 */
function parseInt(value, defaultValue = 0) {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as float
 */
function parseFloat(value, defaultValue = 0.0) {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse comma-separated values
 */
function parseArray(value, defaultValue = []) {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Validate required environment variables
 */
function validateRequired(config) {
  const required = [
    'MONGODB_URI',
    'REDIS_URL', 
    'JWT_SECRET',
    'DEEPGRAM_API_KEY',
    'OPENAI_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Main configuration object
 */
export const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_TEST: process.env.NODE_ENV === 'test',

  // Server Configuration
  PORT: parseInt(process.env.PORT, 3000),
  HOST: process.env.HOST || 'localhost',
  API_VERSION: process.env.API_VERSION || 'v1',
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  // MongoDB Atlas Configuration
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'ai_audio_kb',
  MONGODB_POOL_SIZE: parseInt(process.env.MONGODB_POOL_SIZE, 20),
  MONGODB_MAX_IDLE_TIME: parseInt(process.env.MONGODB_MAX_IDLE_TIME, 30000),
  MONGODB_SERVER_SELECTION_TIMEOUT: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT, 5000),
  MONGODB_SOCKET_TIMEOUT: parseInt(process.env.MONGODB_SOCKET_TIMEOUT, 45000),
  
  // Vector Search Configuration
  VECTOR_INDEX_NAME: process.env.VECTOR_INDEX_NAME || 'audio_embeddings_index',
  VECTOR_DIMENSIONS: parseInt(process.env.VECTOR_DIMENSIONS, 1024), // Voyage-context-3 default
  VECTOR_SIMILARITY: process.env.VECTOR_SIMILARITY || 'cosine',
  VECTOR_SUPPORTED_DIMS: parseArray(process.env.VECTOR_SUPPORTED_DIMS, ['1536', '1024', '768']),
  
  // Atlas Search Configuration  
  SEARCH_INDEX_NAME: process.env.SEARCH_INDEX_NAME || 'audio_text_search',
  SEARCH_ANALYZER: process.env.SEARCH_ANALYZER || 'english',
  
  // Hybrid Search (RRF) Configuration
  HYBRID_VECTOR_WEIGHT: parseFloat(process.env.HYBRID_VECTOR_WEIGHT, 0.6),
  HYBRID_TEXT_WEIGHT: parseFloat(process.env.HYBRID_TEXT_WEIGHT, 0.4),
  HYBRID_TOP_K: parseInt(process.env.HYBRID_TOP_K, 20),
  HYBRID_VECTOR_CANDIDATES: parseInt(process.env.HYBRID_VECTOR_CANDIDATES, 100),
  HYBRID_NUM_CANDIDATES: parseInt(process.env.HYBRID_NUM_CANDIDATES, 1000),
  HYBRID_MIN_SCORE: parseFloat(process.env.HYBRID_MIN_SCORE, 0.7),

  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT, 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: parseInt(process.env.REDIS_DB, 0),

  // Authentication & Security
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  API_KEY_SALT: process.env.API_KEY_SALT,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // CORS Configuration
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000',

  // AWS Configuration
  AWS_REGION: process.env.AWS_REGION || 'us-west-2',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  S3_BUCKET_REGION: process.env.S3_BUCKET_REGION || 'us-west-2',
  S3_PRESIGNED_URL_EXPIRES: parseInt(process.env.S3_PRESIGNED_URL_EXPIRES, 3600),

  // Deepgram Configuration (Primary ASR)
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
  DEEPGRAM_MODEL: process.env.DEEPGRAM_MODEL || 'nova-2',
  DEEPGRAM_LANGUAGE: process.env.DEEPGRAM_LANGUAGE || 'en-US',
  DEEPGRAM_TIER: process.env.DEEPGRAM_TIER || 'enhanced',

  // Google Speech-to-Text Configuration (Fallback ASR)
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
  GOOGLE_STT_MODEL: process.env.GOOGLE_STT_MODEL || 'latest_short',
  GOOGLE_STT_LANGUAGE: process.env.GOOGLE_STT_LANGUAGE || 'en-US',

  // OpenAI Configuration (Legacy Support)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_ORGANIZATION: process.env.OPENAI_ORGANIZATION,
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  OPENAI_EMBEDDING_DIMENSIONS: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS, 1536),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS, 4096),
  
  // Voyage AI Configuration (Primary Embeddings)
  VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
  VOYAGE_EMBEDDING_MODEL: process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-context-3',
  VOYAGE_EMBEDDING_DIMENSIONS: parseInt(process.env.VOYAGE_EMBEDDING_DIMENSIONS, 1024),
  VOYAGE_RERANK_MODEL: process.env.VOYAGE_RERANK_MODEL || 'rerank-2.5',
  VOYAGE_CONTEXT_WINDOW: parseInt(process.env.VOYAGE_CONTEXT_WINDOW, 3), // segments
  
  // Embedding Provider Configuration
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'voyage', // voyage|openai|auto
  EMBEDDING_FALLBACK_ENABLED: parseBoolean(process.env.EMBEDDING_FALLBACK_ENABLED, true),
  RERANKING_ENABLED: parseBoolean(process.env.RERANKING_ENABLED, true),
  RERANKING_TOP_K: parseInt(process.env.RERANKING_TOP_K, 20),

  // Langfuse Configuration
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
  LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  LANGFUSE_ENABLED: parseBoolean(process.env.LANGFUSE_ENABLED, true),

  // Audio Processing Configuration
  AUDIO_SAMPLE_RATE: parseInt(process.env.AUDIO_SAMPLE_RATE, 16000),
  AUDIO_CHANNELS: parseInt(process.env.AUDIO_CHANNELS, 1),
  AUDIO_SEGMENT_DURATION: parseInt(process.env.AUDIO_SEGMENT_DURATION, 5000),
  AUDIO_VAD_THRESHOLD: parseFloat(process.env.AUDIO_VAD_THRESHOLD, 0.5),
  AUDIO_SILENCE_THRESHOLD: parseInt(process.env.AUDIO_SILENCE_THRESHOLD, 700),
  AUDIO_MAX_FILE_SIZE: parseInt(process.env.AUDIO_MAX_FILE_SIZE, 50000000),
  SUPPORTED_AUDIO_FORMATS: parseArray(process.env.SUPPORTED_AUDIO_FORMATS, ['opus', 'wav', 'm4a', 'mp3']),

  // Rate Limiting & Performance
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 900000),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: parseBoolean(process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS, false),
  UPLOAD_RATE_LIMIT_MB_PER_SECOND: parseInt(process.env.UPLOAD_RATE_LIMIT_MB_PER_SECOND, 5),
  CONCURRENT_TRANSCRIPTIONS: parseInt(process.env.CONCURRENT_TRANSCRIPTIONS, 10),

  // Cost Controls & Guardrails
  MAX_COST_PER_HOUR_USD: parseFloat(process.env.MAX_COST_PER_HOUR_USD, 0.75),
  COST_ALERT_THRESHOLD_USD: parseFloat(process.env.COST_ALERT_THRESHOLD_USD, 0.60),
  AUTO_THROTTLE_ENABLED: parseBoolean(process.env.AUTO_THROTTLE_ENABLED, true),
  BILLING_ALERTS_ENABLED: parseBoolean(process.env.BILLING_ALERTS_ENABLED, true),

  // WebSocket Configuration
  WS_HEARTBEAT_INTERVAL: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 30000),
  WS_MAX_CONNECTIONS: parseInt(process.env.WS_MAX_CONNECTIONS, 1000),
  WS_MAX_BUFFER_SIZE: parseInt(process.env.WS_MAX_BUFFER_SIZE, 1048576),
  WS_COMPRESSION_ENABLED: parseBoolean(process.env.WS_COMPRESSION_ENABLED, true),

  // Background Jobs Configuration
  REDIS_QUEUE_PREFIX: process.env.REDIS_QUEUE_PREFIX || 'ai-audio-kb',
  QUEUE_CONCURRENCY: parseInt(process.env.QUEUE_CONCURRENCY, 5),
  JOB_RETRY_ATTEMPTS: parseInt(process.env.JOB_RETRY_ATTEMPTS, 3),
  JOB_RETRY_DELAY: parseInt(process.env.JOB_RETRY_DELAY, 5000),

  // Monitoring & Metrics
  PROMETHEUS_ENABLED: parseBoolean(process.env.PROMETHEUS_ENABLED, true),
  PROMETHEUS_PORT: parseInt(process.env.PROMETHEUS_PORT, 9090),
  HEALTH_CHECK_ENABLED: parseBoolean(process.env.HEALTH_CHECK_ENABLED, true),
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL, 30000),

  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE_ENABLED: parseBoolean(process.env.LOG_FILE_ENABLED, true),
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || './logs/app.log',
  LOG_FILE_MAX_SIZE: process.env.LOG_FILE_MAX_SIZE || '10mb',
  LOG_FILE_MAX_FILES: parseInt(process.env.LOG_FILE_MAX_FILES, 5),
  LOG_CONSOLE_ENABLED: parseBoolean(process.env.LOG_CONSOLE_ENABLED, true),

  // Regional Policies
  REGION_POLICY_FILE: process.env.REGION_POLICY_FILE || './config/region-policies.json',
  DEFAULT_REGION: process.env.DEFAULT_REGION || 'US-CA',
  AUDIT_LOG_RETENTION_DAYS: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 2555),
  CONSENT_HASH_ALGORITHM: process.env.CONSENT_HASH_ALGORITHM || 'sha256',

  // Circuit Breaker Configuration
  CIRCUIT_BREAKER_ENABLED: parseBoolean(process.env.CIRCUIT_BREAKER_ENABLED, true),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 5),
  CIRCUIT_BREAKER_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT, 60000),
  CIRCUIT_BREAKER_RESET_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 30000),

  // Feature Flags
  FEATURE_WEBSOCKET_STREAMING: parseBoolean(process.env.FEATURE_WEBSOCKET_STREAMING, true),
  FEATURE_BATCH_PROCESSING: parseBoolean(process.env.FEATURE_BATCH_PROCESSING, true),
  FEATURE_AGENT_INTEGRATION: parseBoolean(process.env.FEATURE_AGENT_INTEGRATION, true),
  FEATURE_TEAM_SHARING: parseBoolean(process.env.FEATURE_TEAM_SHARING, false),
  FEATURE_ADVANCED_ANALYTICS: parseBoolean(process.env.FEATURE_ADVANCED_ANALYTICS, false),

  // Development & Testing
  MOCK_ASR_ENABLED: parseBoolean(process.env.MOCK_ASR_ENABLED, false),
  MOCK_EMBEDDING_ENABLED: parseBoolean(process.env.MOCK_EMBEDDING_ENABLED, false),
  SEED_DATA_ENABLED: parseBoolean(process.env.SEED_DATA_ENABLED, false)
};

// Validate configuration on import
if (!config.IS_TEST) {
  try {
    validateRequired(config);
    logger.info('Configuration validated successfully', {
      nodeEnv: config.NODE_ENV,
      port: config.PORT,
      mongodbConfigured: !!config.MONGODB_URI,
      redisConfigured: !!config.REDIS_URL,
      deepgramConfigured: !!config.DEEPGRAM_API_KEY,
      openaiConfigured: !!config.OPENAI_API_KEY
    });
  } catch (error) {
    logger.error('Configuration validation failed', {
      error: error.message,
      env: config.NODE_ENV
    });
    
    if (config.IS_PRODUCTION) {
      process.exit(1);
    }
  }
}

export default config;
