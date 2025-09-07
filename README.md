# 🎯 AI Audio Knowledge Base

> Production-grade iPhone application for continuous audio recording that streams into a knowledge base for AI agents.

## 🚀 Quick Start

### Prerequisites
- iOS 17.0+
- Xcode 15.0+
- Node.js 20+
- PostgreSQL 15+ with pgvector extension
- Redis 7+

### Development Setup
```bash
# Clone and setup
git clone https://github.com/prompted365/ai-audio-kb.git
cd ai-audio-kb

# Backend setup
cd backend
npm install
cp .env.example .env  # Configure your environment
npm run dev

# iOS setup
cd ../ios
xed AIAudioKB.xcodeproj  # Opens in Xcode
```

## 🏗️ Architecture

### Core Components
- **iOS App**: Swift/SwiftUI with AVAudioEngine for capture
- **Backend**: Node.js streaming pipeline with WebSocket support
- **ASR**: Deepgram (primary) + Google STT (fallback)
- **Knowledge Base**: PostgreSQL with pgvector + BM25 hybrid search
- **Storage**: S3 with Object Lock (WORM compliance)
- **Agent Integration**: Event-driven architecture with Langfuse tracing

### Technical Stack

#### iOS (Native Swift)
- **Audio**: AVAudioEngine, CallKit integration
- **Storage**: Core Data with encryption
- **Network**: WebSocket streaming + batch uploads
- **Background**: Background app refresh + audio sessions
- **Security**: Apple App Attest + keychain storage

#### Backend Infrastructure  
- **Ingestion**: WebSocket server with back-pressure handling
- **ASR Pipeline**: Deepgram streaming + batch processing
- **Vector Store**: PostgreSQL with pgvector extension
- **Observability**: Grafana + Langfuse + structured logging
- **Cost Controls**: Usage metering + automatic throttling

## 📊 Development Timeline

### Phase 1: MVP (Weeks 1-2) ✅ Current
- [x] Project structure and documentation
- [ ] Foreground audio capture (AVAudioEngine)
- [ ] Voice Activity Detection (VAD) with 700ms silence threshold  
- [ ] Encrypted local buffer with 5-10s segments
- [ ] Batch upload with retry logic
- [ ] Basic transcription pipeline
- [ ] Consent management + audit logging

### Phase 2: Pilot (Weeks 3-4)
- [ ] WebSocket streaming with resumable transfers
- [ ] CallKit integration for phone calls
- [ ] Apple Shortcuts + Widget support
- [ ] 3 AI agent integrations (lead capture, daily summary, audit)
- [ ] Network-aware adaptive bitrate
- [ ] Team sharing functionality

### Phase 3: Production (Weeks 5-8)
- [ ] Full ABR matrix with cost optimization
- [ ] Battery-aware performance tuning
- [ ] WORM compliance + data residency controls
- [ ] App Store submission preparation
- [ ] SLA enforcement + error budgets
- [ ] Phased rollout (1% → 5% → 20% → GA)

## 🔒 Security & Privacy

### Privacy Controls
- **Granular Consent**: Per-region, per-call recording toggles
- **Data Residency**: Configurable geographic boundaries
- **Audit Trail**: Immutable consent + access logging
- **Right to Delete**: <24hr DSR response SLA

### Technical Security
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Authentication**: Tenant API keys + Apple App Attest
- **Replay Protection**: ULID-based deduplication
- **Kill Switch**: Runtime disable capability

## 📱 Key Features

### User Experience
- **Session Management**: Searchable transcript library
- **Smart Search**: Hybrid BM25 + vector similarity  
- **Apple Integration**: Siri Shortcuts, Control Center widgets
- **Team Collaboration**: Shared workspaces + permissions

### Performance Targets
- **Battery Life**: <15% drain per 8hr recording day
- **ASR Latency**: <3s p95 for 10s segments
- **Cost Efficiency**: ≤$0.75/hour audio processing
- **Reliability**: 99.5% uptime, 99.2% crash-free sessions

## 🤖 AI Agent Integration

### Event Schema
```json
{
  "event_id": "ulid",
  "audio_segment": "s3://bucket/segment.opus", 
  "transcript": "text content",
  "metadata": {
    "duration_ms": 5200,
    "speakers": ["user", "caller"],
    "confidence": 0.94,
    "pii_detected": true
  },
  "embedding": [0.1, -0.3, ...], // 768-dim vector
  "tags": ["sales_call", "pricing", "objection"]
}
```

### Agent Workflows
- **Lead Capture**: Extract contact info + intent
- **Daily Summary**: Aggregate key conversations  
- **Compliance**: Flag sensitive content + consent violations

## 📈 Success Metrics

### Technical KPIs
- Ingest success rate ≥99.5%
- ASR p95 latency <3.0s per 10s segment
- Cost per audio hour ≤$0.75
- Battery efficiency >85% retention after 8hrs

### Business KPIs  
- User retention (D7/D30)
- Monthly transcription hours
- Agent interaction frequency
- Net Promoter Score (NPS)

## 🛠️ Development Tracks

This project follows a **6-track parallel development** model:
- **Track A**: Ingestion & Transport
- **Track B**: Intelligence Pipeline  
- **Track C**: Security & Compliance
- **Track D**: Device Performance
- **Track E**: UX & Monetization
- **Track F**: Observability & Operations

## 📚 Documentation

- [Architecture Decision Records (ADRs)](./docs/adrs/)
- [API Documentation](./docs/api/)
- [Deployment Guide](./docs/deployment/)
- [Security Guidelines](./docs/security/)
- [Runbooks](./docs/runbooks/)

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with ⚡ speed, 🔒 security, and 🤖 AI-first architecture.**
