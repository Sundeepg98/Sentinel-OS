---
label: Deliverability & Protocol Infra
type: map
icon: Network
data:
  - id: auth_protocols
    title: Advanced Auth Protocols
    tech: MTA-STS + TLS-RPT
    bottleneck: MITM Downgrade Attacks
    scenario: Ensuring email servers utilize TLS and receiving failure telemetry.
    code: |
      # MTA-STS Policy Example
      version: STSv1
      mode: enforce
      mx: mail.mailin.ai
      max_age: 604800
  - id: rate_limiting
    title: ISP Rate Limiting
    tech: Dynamic Throttling
    bottleneck: 4xx SMTP Errors
    scenario: Navigating Google's ML-driven filters vs. Microsoft's rigid connection limits.
    code: |
      # Distributed Backpressure Strategy
      - Leaky Bucket (Fixed output rate)
      - Sliding Window (Redis counters)
      - Exponential Backoff (Retry jitter)
  - id: feedback_loops
    title: Feedback Loops (FBL)
    tech: Real-time Telemetry
    bottleneck: Spam Complaint Anomalies
    scenario: Microsoft/Yahoo transmitting diagnostic reports to suppress sending instantly.
    code: |
      # Real-time Suppression
      if (complaint_anomaly_detected) {
        suppress_recipient()
        adjust_ip_routing()
      }
---

# Advanced Deliverability Architecture

Achieving sustained inbox placement at a scale of 500 million emails/month requires adapting dynamically to opaque ISP algorithms.

## Security Standards
Beyond SPF/DKIM, Mailin implements:
*   **MTA-STS**: Forces TLS connections.
*   **TLS-RPT**: Diagnostic telemetry for connection failures.
*   **BIMI**: Displays verified brand logos using Verified Mark Certificates.

## Throttling Algorithms
*   **Google Workspace:** Machine-learning driven, evaluates reputation in real-time.
*   **Microsoft O365:** Strict binary approach, rigid connection limits.
*   **Yahoo Mail:** Aggressive concurrent connection limits (as few as 5 simultaneous sockets).
