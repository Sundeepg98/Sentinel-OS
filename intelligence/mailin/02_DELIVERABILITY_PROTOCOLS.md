---
label: Deliverability Protocols
type: map
icon: Shield
data:
  - id: security_protocols
    title: MTA-STS & TLS-RPT
    tech: Advanced Security Standards
    bottleneck: MITM Downgrade Attacks
    scenario: Forcing encrypted connections and receiving connection failure telemetry.
    code: |
      # MTA-STS Policy Served via HTTPS
      version: STSv1
      mode: enforce
      mx: mail.mailin.ai
      max_age: 604800
  - id: brand_auth
    title: BIMI & VMC
    tech: Brand Indicators
    bottleneck: Recipient Engagement
    scenario: Using Verified Mark Certificates to display brand logos in inboxes.
    code: |
      # BIMI DNS Record
      default._bimi TXT "v=BIMI1; l=https://mailin.ai/logo.svg; a=https://mailin.ai/vmc.pem"
  - id: backpressure
    title: Distributed Backpressure
    tech: Leaky Bucket / Sliding Window
    bottleneck: ISP Connection Limits
    scenario: Throttling traffic to Microsoft (binary limits) vs. Google (ML-driven dynamic limits).
    code: |
      # Backpressure Strategies
      - Leaky Bucket (Fixed output rate)
      - Redis Sliding Window (Real-time counters)
      - Exponential Backoff (Retry jitter)
---

# Advanced Deliverability Architecture

Achieving sustained inbox placement requires adapting dynamically to the opaque algorithms of major ISPs.

## Feedback Loops (FBL)
Specialized telemetry mechanism between ISPs (Microsoft, Yahoo) and Mailin. Reports recipient "spam" marks in near real-time.
- **Real-time Suppression**: Automatically halts traffic to recipients to prevent IP blacklisting.
- **Reputation Input**: reports act as dynamic inputs for broader reputation management algorithms.

## Throttling Algorithms
- **Google Workspace**: ML-driven dynamic rate limiting evaluating sender reputation in real-time.
- **Microsoft Office 365**: Strict binary approaches with rigid connection limits.
- **Yahoo Mail**: Aggressive concurrent limits (as few as 5 simultaneous sockets per IP).
