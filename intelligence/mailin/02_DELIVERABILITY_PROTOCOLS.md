---
label: "Deliverability Protocols"
type: "markdown"
icon: "Zap"
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
