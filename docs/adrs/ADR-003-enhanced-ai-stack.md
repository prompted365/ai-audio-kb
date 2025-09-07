# ADR-003: Enhanced AI Stack with MongoDB AI-Native Capabilities

**Status**: Approved  
**Date**: 2025-01-07  
**Deciders**: Engineering Team, Architecture Review  
**Supersedes**: Original ADR-003 (Pilot Tech Selections)

## Context

Based on the latest MongoDB AI-native capabilities available in 2025, we're upgrading our technology selections to leverage cutting-edge vector search, embedding models, and hybrid retrieval capabilities that weren't available in our original planning.

## Enhanced Technology Selections

### **Core Database & Search Stack**
- **Store**: MongoDB Atlas (replica set) with Global Clusters
- **Vector Search**: Atlas Vector Search (HNSW, cosine similarity)  
- **Text Search**: Atlas Search (BM25 + fuzzy matching)
- **Hybrid Search**: **Reciprocal Rank Fusion (RRF)** combining $vectorSearch + $search
- **Regional Compliance**: Data Federation with per-tenant `dataRegion` routing

### **AI/ML Model Stack**

#### **Embeddings**: Voyage AI Integration
- **Primary**: `voyage-context-3` (context-aware embeddings)
- **Fallback**: `voyage-3.5` / `voyage-3.5-lite` for cost optimization
- **Legacy Support**: OpenAI `text-embedding-3-small` (1536-dim)
- **Vector Dimensions**: Enum {1536, 1024, 768} with adapter interface

#### **Reranking**: Enterprise-Grade Precision
- **Primary**: `rerank-2.5` (highest accuracy)  
- **Cost-Optimized**: `rerank-2.5-lite`
- **Target**: p@1 ≥ 0.85 (precision at rank 1)
- **Integration**: Post-vector-search reranking layer

#### **ASR Pipeline**: Multi-Provider Resilience  
- **Primary**: Deepgram Nova-2 (streaming)
- **Fallback**: Google STT (batch processing)
- **Failover**: Automatic provider switching with audit logging
- **Cost Target**: ≤ $0.75/hour audio processing

### **Advanced Search Architecture**

#### **Hybrid Retrieval Configuration**
```javascript
// RRF Parameters
const searchConfig = {
  vectorWeight: 0.6,        // Vector similarity priority
  textWeight: 0.4,          // BM25 text matching
  k: 20,                    // Final results returned
  vectorTopK: 100,          // Pre-fusion vector candidates  
  numCandidates: 1000,      // HNSW search candidates
  minScore: 0.7             // Relevance threshold
};

// HNSW Optimization
const indexParams = {
  m: 16,                    // Connections per layer
  efConstruction: 200,      // Build-time search width
  similarity: 'cosine'      // Distance metric
};
```

#### **Index Lag Management**
- **Freshness SLA**: 98% of segments searchable within 60s
- **Operational Fallback**: Direct DB queries for recent unsearched content
- **Monitoring**: Index lag histogram with alerting

### **Agent Integration Architecture**

#### **Model Context Protocol (MCP) Server**
- **MongoDB MCP Server**: Natural language database interface
- **Agent Tools**: Claude, Copilot, Windsurf integration
- **Capabilities**: Schema introspection, query generation, code assistance
- **Use Cases**: Development acceleration, debugging, analytics

#### **LangChain/LlamaIndex Integration**
```python
# Modular agent pipeline design
class AIAudioKBPipeline:
    def __init__(self):
        self.vector_store = MongoDBAtlasVectorSearch()
        self.memory = MongoDBChatMemory()  # Long-term memory
        self.local_memory = SQLiteMemory()  # Short-term session memory
        self.reranker = VoyageReranker(model="rerank-2.5")
        
    def search_with_rerank(self, query: str, k: int = 20):
        # 1. Hybrid search (RRF)
        candidates = self.hybrid_search(query, k=100)
        # 2. Rerank for precision  
        return self.reranker.rerank(candidates, k=k)
```

#### **Agent Memory Architecture**
- **Short-term**: SQLite for session context and active conversations
- **Long-term**: MongoDB collections for persistent knowledge and published content
- **Integration**: n8n Vector Store + Chat Memory nodes support

### **Data Architecture**

#### **Collection Schema Updates**
```javascript
// Enhanced segments collection
{
  "_id": "01J9...ULID",
  "tenantId": "01J9...ULID", 
  "sessionId": "01J9...ULID",
  "seq": 42,
  
  // Audio and timeline
  "timeline": { "startMs": 420000, "endMs": 430000 },
  "audio": {
    "s3": "s3://bucket/tenant/.../segments/01J9...m4a",
    "codec": "AAC", 
    "sampleRate": 48000,
    "bytes": 183456
  },
  
  // Enhanced transcription with speaker detection
  "transcript": {
    "text": "let's meet at four o'clock...",
    "textRedacted": "let's meet at [TIME]...",  // PII-masked for search
    "language": "en",
    "confidence": 0.94,
    "speakers": [
      { "id": "speaker_1", "label": "user" },
      { "id": "speaker_2", "label": "caller" }
    ],
    "words": [
      { "word": "let's", "start": 420000, "end": 420250, "confidence": 0.98 }
    ]
  },
  
  // Voyage AI embeddings  
  "embedding": {
    "model": "voyage-context-3",
    "dimensions": 1024,
    "vector": [0.0123, -0.456, ...],
    "contextWindow": "previous_segment_text + current + next_segment_text"
  },
  
  // Enhanced metadata
  "vad": { "speechRatio": 0.78, "avgDb": -18.2 },
  "tags": ["meeting", "calendar", "scheduling"],
  "entities": ["time:4pm", "action:reschedule"],
  
  // Compliance & Privacy
  "sensitive": {
    "piiDetected": false,
    "entities": [],
    "redactionMap": {}
  },
  
  // Search optimization
  "indexedAt": null,  // Set when searchable in Atlas
  "searchScore": 0.92,  // Last rerank score for quality monitoring
  
  "createdAt": "2025-09-07T01:07:00Z"
}
```

### **Performance Targets**

#### **Search Performance**  
- Vector search stage: <50ms p95 (improved from 100ms)
- Text search stage: <60ms p95  
- RRF merge: <10ms p95
- End-to-end search: <150ms p95 (improved from 200ms)
- Reranking latency: <100ms p95

#### **AI Model Performance**
- Voyage embedding: <200ms per segment
- Rerank-2.5: <150ms for top-20 candidates  
- Context-aware retrieval: >15% accuracy improvement over basic embeddings

#### **Cost Optimization**
- Voyage-3.5-lite: 50% cost reduction vs voyage-context-3
- Rerank-2.5-lite: 40% cost reduction vs rerank-2.5
- Atlas M10 → M20 scaling path with usage-based optimization

### **Integration Capabilities**

#### **Agentic Workflows**
```javascript
// Agent trigger pipeline
const agentPipeline = {
  // 1. Real-time change streams
  changeStreams: {
    collection: 'segments',
    pipeline: [
      { $match: { 'fullDocument.indexedAt': { $ne: null } } }
    ],
    handler: 'triggerAgentWorkflows'
  },
  
  // 2. Agent routes
  agents: [
    { name: 'lead_capture', trigger: 'transcript.entities.contact' },
    { name: 'daily_summary', trigger: 'sessionEnd', schedule: 'daily' },
    { name: 'compliance_audit', trigger: 'sensitive.piiDetected' }
  ],
  
  // 3. Langfuse tracing
  tracing: {
    spans: ['ingest', 'asr', 'embed', 'index', 'search', 'rerank', 'agent.trigger'],
    costTracking: true,
    latencyMonitoring: true
  }
};
```

#### **External Integrations**
- **Cohere**: RAG pipeline integration
- **Baseten**: Compute orchestration for model serving
- **AWS Bedrock**: Foundation model deployment
- **n8n**: Workflow automation with vector store nodes

## Migration Strategy

### **Phase 1: Voyage AI Integration (Week 2)**
1. Implement embedding adapter interface
2. Deploy voyage-context-3 alongside OpenAI embeddings
3. A/B test retrieval quality improvements
4. Migrate to Voyage as primary embedding provider

### **Phase 2: Hybrid Search + Reranking (Week 3)**  
1. Implement RRF hybrid search pipeline
2. Deploy rerank-2.5 post-processing layer
3. Performance benchmark vs basic vector search
4. Tune vector/text weighting for optimal relevance

### **Phase 3: MCP + Agent Integration (Week 4)**
1. Deploy MongoDB MCP Server for development acceleration  
2. Implement LangChain/LlamaIndex connectors
3. Set up agent memory architecture (SQLite + MongoDB)
4. Configure n8n workflow nodes for agent orchestration

### **Phase 4: Advanced Features (Week 5-6)**
1. Context-aware embeddings with sliding window
2. Speaker detection and multi-speaker search
3. Entity extraction and semantic tagging
4. Advanced PII detection and redaction

## Success Metrics

### **Retrieval Quality**
- **Precision@5**: >0.90 (target: 0.95)
- **Recall@20**: >0.85 (target: 0.90)  
- **Rerank Improvement**: +15% relevance vs base vector search
- **Context-Aware Improvement**: +20% vs standard embeddings

### **Performance & Cost**
- **Search Latency**: <150ms p95 end-to-end
- **Embedding Cost**: <$0.02 per segment (Voyage vs OpenAI)
- **Total AI Cost**: <$0.60 per audio hour (improved from $0.75)
- **Index Freshness**: 98% searchable within 60s

### **Developer Experience**
- **MCP Integration**: Natural language queries working in Claude/Windsurf
- **Agent Development**: 50% reduction in boilerplate code
- **Memory Persistence**: 95% conversation context retention
- **Multi-modal Search**: Support for audio + text + metadata queries

## Risk Mitigation

### **Model Dependency**
- **Embedding Adapter**: Abstract interface supports OpenAI, Voyage, Cohere
- **Provider Failover**: Automatic fallback between embedding providers
- **Cost Controls**: Per-model usage limits and alerts
- **Quality Monitoring**: Automated A/B testing of model performance

### **Performance Degradation**
- **Hybrid Search Tuning**: Configurable vector/text weights per tenant
- **Rerank Bypassing**: Disable reranking under high load
- **Index Lag Fallback**: Direct DB queries when search indexes lag
- **Circuit Breakers**: Automatic degradation to simpler search methods

## Approval Status

- [x] Engineering Team Lead  
- [x] Architecture Review Board
- [x] AI/ML Research Team
- [x] Cost Management (Finance)
- [x] Developer Experience Team

**Implementation Start**: Week 2 of development cycle  
**Full Rollout Target**: Week 6 with gradual feature activation

---

**This enhanced AI stack positions us at the forefront of vector search and AI-powered retrieval, with enterprise-grade precision, cost optimization, and developer productivity improvements.**
