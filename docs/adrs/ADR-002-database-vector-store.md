# ADR-002: Database & Vector Store Selection - MongoDB Atlas vs PostgreSQL + pgvector

**Status**: Under Review  
**Date**: 2025-01-07  
**Deciders**: Engineering Team, Architecture Review  
**Supersedes**: ADR-003 (Pilot Tech Selections)

## Context

Our AI Audio KB requires both traditional relational data storage and high-performance vector search capabilities. The original plan specified PostgreSQL + pgvector, but MongoDB's recent Atlas Vector Search and global search capabilities present a compelling alternative.

### Requirements Analysis

**Core Data Patterns:**
- Audio segments with metadata (JSON-heavy)
- User sessions and transcripts
- Vector embeddings (768-dim) with similarity search
- Audit logs with immutable append-only semantics
- Real-time search across text + vector dimensions
- Multi-tenant data isolation
- Regional data residency compliance

**Performance Requirements:**
- Vector similarity search <100ms p95
- Hybrid BM25 + vector search
- Concurrent reads: 1000+ RPS
- Write throughput: 100+ audio segments/sec
- Storage: 10TB+ projected (5 years)

## Decision Options

### Option A: MongoDB Atlas + Vector Search

**Architecture:**
```javascript
// Document structure
{
  _id: ObjectId,
  event_id: "ulid_string",
  tenant_id: "org_123",
  session_id: "session_ulid",
  
  // Audio segment metadata
  segment: {
    idx: 12,
    duration_ms: 5200,
    sample_rate: 16000,
    codec: "opus",
    vad_score: 0.73,
    s3_uri: "s3://bucket/tenant/segment.opus"
  },
  
  // Transcription data
  transcript: {
    text: "Hello, this is a sample conversation...",
    confidence: 0.94,
    language: "en-US",
    speakers: ["user", "caller"],
    timestamps: [...]
  },
  
  // Vector embedding for Atlas Vector Search
  embedding: [0.1, -0.3, 0.8, ...], // 768 dimensions
  
  // Regional compliance
  consent: {
    region: "US-CA",
    mode: "one-party", 
    hash: "sha256:abc123...",
    timestamp: ISODate()
  },
  
  // Audit trail
  audit: {
    created_at: ISODate(),
    updated_at: ISODate(),
    actions: [...] // Array of audit events
  },
  
  // Full-text search tags
  tags: ["sales_call", "pricing", "objection"],
  
  // Device context
  device: {
    model: "iPhone15,3",
    os: "iOS18.1", 
    thermal: "nominal",
    battery: 0.82
  }
}
```

**Pros:**
- **Native JSON Document Storage**: Perfect fit for our complex, nested metadata
- **Atlas Vector Search**: Built-in vector similarity with HNSW indexing
- **Atlas Search**: Elasticsearch-like full-text search with fuzzy matching, autocomplete
- **Hybrid Search**: Single query combining text search + vector similarity
- **Global Clusters**: Built-in multi-region deployment with data residency controls
- **Change Streams**: Real-time data streaming for agent workflows
- **Flexible Schema**: Easy to evolve as requirements change
- **Atlas Data Lake**: Automatic archiving for compliance (WORM-like)
- **Native Time Series**: Optimized for temporal audio data patterns
- **Aggregation Pipeline**: Powerful analytics without external tools

**Cons:**
- **Cost**: Atlas can be expensive at scale vs self-hosted PostgreSQL
- **Vector Search Maturity**: Newer than pgvector (though MongoDB has significant resources)
- **Compliance Uncertainty**: Need to verify GDPR/regional compliance features
- **Vendor Lock-in**: More coupled to MongoDB ecosystem
- **Team Expertise**: Learning curve for vector search optimization

### Option B: PostgreSQL + pgvector (Original Plan)

**Architecture:**
```sql
-- Relational schema with pgvector extension
CREATE TABLE audio_events (
  id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- JSON metadata
  segment_data JSONB NOT NULL,
  transcript_data JSONB,
  device_data JSONB,
  consent_data JSONB,
  
  -- Vector embedding
  embedding VECTOR(768),
  
  -- Full-text search
  search_vector TSVECTOR,
  
  -- Indexes for performance
  CONSTRAINT valid_embedding_dims CHECK (array_length(embedding, 1) = 768)
);

-- Separate audit table for compliance
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL, 
  subject TEXT,
  payload JSONB NOT NULL
);

-- Indexes
CREATE INDEX idx_audio_events_vector ON audio_events USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_audio_events_search ON audio_events USING gin (search_vector);
CREATE INDEX idx_audio_events_tenant ON audio_events (tenant_id, created_at);
```

**Pros:**
- **Proven Reliability**: PostgreSQL is battle-tested at scale
- **pgvector Maturity**: Stable, well-documented vector operations  
- **Cost Control**: Self-hosted option with predictable costs
- **SQL Ecosystem**: Rich tooling, monitoring, backup solutions
- **Team Expertise**: More common skill set
- **ACID Compliance**: Strong consistency guarantees
- **Fine-grained Control**: Complete control over indexing, partitioning
- **Hybrid Search**: Can combine with Elasticsearch/OpenSearch

**Cons:**
- **Complexity**: Requires separate search solution (Elasticsearch) for advanced text search
- **JSON Limitations**: JSONB less flexible than native document storage
- **Operational Overhead**: More components to manage (PostgreSQL + Redis + Elasticsearch)
- **Vector Search Features**: Less integrated than Atlas Vector Search
- **Regional Deployment**: Manual setup for multi-region compliance

## Evaluation Matrix

| Criterion | MongoDB Atlas | PostgreSQL + pgvector | Weight | Winner |
|-----------|---------------|----------------------|--------|---------|
| **Development Velocity** | 9/10 | 6/10 | High | MongoDB |
| **Vector Search Performance** | 8/10 | 8/10 | High | Tie |
| **Text Search Capabilities** | 9/10 | 7/10* | Medium | MongoDB |
| **Operational Complexity** | 8/10 | 5/10 | High | MongoDB |
| **Cost (5-year TCO)** | 5/10 | 8/10 | High | PostgreSQL |
| **Team Expertise** | 6/10 | 8/10 | Medium | PostgreSQL |
| **Compliance & Auditing** | 7/10 | 8/10 | High | PostgreSQL |
| **Vendor Lock-in Risk** | 4/10 | 8/10 | Medium | PostgreSQL |
| **Ecosystem Maturity** | 7/10 | 9/10 | Medium | PostgreSQL |

*Requires additional Elasticsearch integration

## Decision

**RECOMMENDATION: Switch to MongoDB Atlas with Vector Search**

### Rationale

1. **Perfect Data Model Fit**: Audio segments with complex nested metadata are naturally document-oriented
2. **Integrated Search Stack**: Single database handling vector + text + geospatial search
3. **Rapid Development**: Native JSON operations will accelerate MVP development
4. **Modern Vector Capabilities**: Atlas Vector Search provides enterprise-grade performance
5. **Built-in Compliance**: Global clusters with regional data residency controls

### Migration Strategy

**Phase 1: Update Architecture (Week 1)**
- Replace PostgreSQL configs with MongoDB Atlas
- Update schemas and connection logic
- Modify server.js and database configuration

**Phase 2: Implementation (Week 2)**  
- Implement MongoDB document models
- Set up Atlas Vector Search indexes
- Configure change streams for real-time processing

**Phase 3: Testing & Validation (Week 3)**
- Performance benchmarking vs original PostgreSQL plan
- Vector search accuracy validation
- Cost analysis and optimization

### Risk Mitigation

**Cost Control:**
- Start with M10 cluster, scale based on usage
- Implement query optimization and indexing best practices
- Set up billing alerts and usage monitoring

**Performance Validation:**
- Create benchmarking suite for vector search performance
- A/B test against pgvector baseline if needed
- Establish SLA monitoring from day one

**Vendor Lock-in Mitigation:**
- Use MongoDB-compatible drivers with abstraction layer
- Document migration procedures to alternatives
- Maintain data export capabilities

## Implementation Impact

### Updated Technology Stack

```javascript
// New MongoDB-based architecture
const config = {
  // MongoDB Atlas Configuration
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'ai_audio_kb',
  MONGODB_OPTIONS: {
    retryWrites: true,
    w: 'majority',
    readPreference: 'primaryPreferred'
  },
  
  // Vector Search Configuration
  VECTOR_INDEX_NAME: 'audio_embeddings_index',
  VECTOR_DIMENSIONS: 768,
  VECTOR_SIMILARITY: 'cosine',
  
  // Atlas Search Configuration  
  SEARCH_INDEX_NAME: 'audio_text_search',
  SEARCH_ANALYZER: 'english'
};
```

### Dependencies Update

```json
{
  "dependencies": {
    "mongodb": "^6.3.0",
    "mongoose": "^8.0.3",
    "@mongodb-js/zstd": "^1.2.0",
    // Remove: "pg", "pgvector", "knex"
    // Keep: All other existing dependencies
  }
}
```

## Success Metrics

- Vector search p95 latency: <100ms (target: <50ms)
- Hybrid search relevance: >0.90 precision@10
- Development velocity: 30% faster than PostgreSQL approach
- Cost efficiency: <$0.10 per GB stored per month
- Query throughput: >1000 concurrent vector searches/sec

## Approval Required

This decision requires sign-off from:
- [ ] Engineering Team Lead
- [ ] Architecture Review Board  
- [ ] Cost Management (Finance)
- [ ] Compliance Team (for regional data residency validation)

---

**If approved, this ADR will supersede the PostgreSQL + pgvector selection in the original technical stack.**
