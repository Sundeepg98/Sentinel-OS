---
label: Deliverability & Backpressure
type: map
icon: Network
data:
  - id: leaky_bucket
    title: Leaky Bucket Algorithm
    tech: Queue Buffer
    bottleneck: Binary Connection Limits
    scenario: Microsoft O365 rigid connection thresholds causing socket drops.
    code: |
      # Treat outbound queues as a fixed-rate buffer
      rate = 50 # connections/min
      output = buffer.drain(rate)
  - id: redis_rate_limit
    title: Dynamic Rate Limiting
    tech: Redis Sliding Window
    bottleneck: ML-Driven Throttles
    scenario: Google's ML-driven filters adjusting throttle based on engagement.
    code: |
      # Adjust throughput based on real-time 4xx deferral feedback
      current_limit = redis.get("throttle:google")
      if (deferral_spike) backoff(current_limit * 0.8)
  - id: exponential_backoff
    title: Exponential Backoff
    tech: Jittered Retries
    bottleneck: Retry Storms
    scenario: Large-scale corporate firewalls blacklisting bursty retry traffic.
    code: |
      delay = (2 ^ attempt) + random_jitter()
      wait(delay)
---

# Advanced Deliverability & Feedback Loops

Achieving sustained inbox placement for half a billion emails monthly requires an infrastructure capable of adapting dynamically to ISP algorithms.

## Telemetry: Feedback Loops (FBLs)
An FBL is a specialized telemetry mechanism between an ISP and Mailin. When a recipient marks a message as spam, the ISP transmits a diagnostic report. Mailin processes this in near real-time to automatically suppress further transmission and adjust IP routing.

## Backpressure Strategies
Mailin uses distributed backpressure to ensure downstream systems are not overwhelmed.
- **Circuit Breakers**: Temporarily halt traffic to specific ISPs if failure thresholds are breached.
- **TLS Telemetry**: Implements MTA-STS and TLS-RPT to neutralize man-in-the-middle attacks and receive connection diagnostic reports.
