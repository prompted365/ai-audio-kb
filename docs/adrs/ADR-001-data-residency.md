# ADR-001: Data Residency & Jurisdictional Policy

**Status**: Accepted  
**Date**: 2025-01-07  
**Deciders**: Engineering Team, Legal, Compliance  

## Context

AI Audio KB processes sensitive audio data including personal conversations and potential phone calls. Different jurisdictions have varying recording consent laws and data residency requirements. We need a flexible system that can adapt to regional regulations while maintaining operational efficiency.

## Decision

We will implement a **region-based data residency and consent framework** with the following components:

### 1. Regional Policy Engine
```json
{
  "regions": {
    "US-CA": {
      "status": "allowed",
      "consent_mode": "one-party",
      "data_residency": "us-west-2",
      "retention_days": 2555, // 7 years
      "pii_masking": false
    },
    "US-FL": {
      "status": "allowed", 
      "consent_mode": "one-party",
      "data_residency": "us-east-1",
      "retention_days": 2555,
      "pii_masking": false
    },
    "EU-DE": {
      "status": "grey",
      "consent_mode": "all-party",
      "data_residency": "eu-central-1",
      "retention_days": 1095, // 3 years max
      "pii_masking": true
    },
    "CN": {
      "status": "blocked",
      "reason": "Regulatory complexity"
    }
  }
}
```

### 2. Runtime Controls
- **Device Kill Switch**: Instant disable via remote config
- **Backend Kill Switch**: Per-tenant circuit breaker
- **Consent Hash**: SHA-256(region + version + timestamp + actor_id)
- **Audit Trail**: Immutable consent decisions in dedicated table

### 3. Implementation Details

#### Device-Level Controls
```swift
// iOS implementation
struct ConsentManager {
    func validateRegion() -> ConsentStatus {
        let region = LocationManager.shared.currentRegion
        let policy = RegionPolicy.load(for: region)
        
        guard policy.status == .allowed else {
            return .blocked(reason: policy.reason)
        }
        
        return .allowed(policy: policy)
    }
    
    func generateConsentHash(region: String, userId: String) -> String {
        let payload = "\(region):\(AppVersion.current):\(Date().timeIntervalSince1970):\(userId)"
        return SHA256.hash(data: payload.data(using: .utf8)!).compactMap { 
            String(format: "%02x", $0) 
        }.joined()
    }
}
```

#### Backend Enforcement
```javascript
// Node.js middleware
const regionValidator = async (req, res, next) => {
  const { region, consent_hash } = req.headers;
  const policy = await RegionPolicy.get(region);
  
  if (policy.status === 'blocked') {
    return res.status(403).json({ 
      error: 'Region not supported',
      reason: policy.reason 
    });
  }
  
  // Verify consent hash
  const isValidConsent = await ConsentService.verify(consent_hash, region, req.user.id);
  if (!isValidConsent) {
    return res.status(401).json({ error: 'Invalid consent' });
  }
  
  req.regionPolicy = policy;
  next();
};
```

## Consequences

### Positive
- **Legal Compliance**: Flexible framework adapts to regional laws
- **Operational Safety**: Kill switches prevent regulatory violations
- **Audit Trail**: Complete consent lineage for legal discovery
- **Scalability**: New regions can be added via configuration

### Negative
- **Complexity**: Additional logic in ingestion pipeline
- **Performance**: Consent validation adds ~50ms latency
- **Storage**: Audit logs consume ~10% additional storage
- **Operational Overhead**: Regional policies require legal review

### Risk Mitigation
- **Fallback Behavior**: Unknown regions default to most restrictive policy
- **Circuit Breakers**: Automatic disable if consent validation fails
- **Regular Audits**: Quarterly legal review of regional policies
- **Emergency Procedures**: 24/7 on-call for regulatory issues

## Implementation Timeline

### Week 1: Foundation
- [ ] Region policy schema design
- [ ] Consent hash generation (iOS)
- [ ] Basic audit logging

### Week 2: Backend Integration  
- [ ] Region middleware implementation
- [ ] Consent verification service
- [ ] Circuit breaker logic

### Week 3: Testing & Validation
- [ ] Regional policy test suite
- [ ] Kill switch validation
- [ ] Performance benchmarking

### Week 4: Monitoring & Alerts
- [ ] Consent validation metrics
- [ ] Regional policy violations alerts
- [ ] Audit trail monitoring

## References
- [California Penal Code Section 632](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=632)
- [GDPR Article 6: Lawfulness of processing](https://gdpr-info.eu/art-6-gdpr/)
- [AWS Data Residency Whitepaper](https://docs.aws.amazon.com/whitepapers/latest/aws-overview-security-processes/data-residency.html)
