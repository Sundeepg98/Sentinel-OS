---
label: Deliverability Architecture
type: markdown
icon: Network
---

# Advanced Deliverability Architecture

The digital outreach and sales development sector has decisively pivoted from volume-centric, shared-infrastructure spam architectures toward highly personalized, mathematically constrained outbound campaigns that demand pristine, isolated network environments. 

## The Shared Infrastructure Vulnerability
Historically, organizations attempting to scale outbound email campaigns relied almost exclusively on shared infrastructure providers (Google Workspace, Microsoft Azure). The inherent, mathematically quantifiable vulnerability in utilizing shared infrastructure is the cross-contamination of IP reputation. Within a shared server ecosystem, thousands of distinct tenants route their SMTP traffic through identical subnets and IP addresses. If a single malicious or negligent tenant generates high bounce rates, triggers spam traps, or accumulates recipient complaints, the deliverability rates for all other tenants utilizing that shared infrastructure are symmetrically penalized by major receiving MTAs.

Mailin circumvents this by provisioning completely isolated, dedicated bare-metal servers and private IP address blocks for its user base, shifting the responsibility for reputation management entirely to the individual user's sending behavior.

## Cryptographic Automation & Scale
The platform natively automates the configuration of:
*   **DKIM (DomainKeys Identified Mail)**
*   **SPF (Sender Policy Framework)**
*   **DMARC (Domain-based Message Authentication, Reporting, and Conformance)**
*   **MTA-STS & TLS-RPT**: Forces receiving email servers to utilize TLS and provides diagnostic reports regarding TLS connection failures.
*   **BIMI**: Allows authenticated domains to display verified brand logos directly within the recipient's inbox.

## ISP Rate Limiting & Distributed Backpressure
A persistent operational challenge is navigating the diverse rate-limiting protocols enforced by receiving ISPs. When an infrastructure platform dispatches traffic faster than an ISP is willing to accept it, the ISP responds with transient failure codes (4xx SMTP errors).

To navigate this, the engineering stack implements advanced distributed backpressure mechanisms:
1. **Leaky Bucket Algorithm**: Mitigates strict binary connection limits by ensuring concurrent socket thresholds are never exceeded.
2. **Dynamic Rate Limiting**: Utilizes sliding window counters in centralized datastores like Redis to dynamically adjust throughput based on real-time 4xx deferral feedback.
3. **Exponential Backoff**: Introduces progressively longer delays between retry attempts to prevent retry storms.
4. **Circuit Breakers**: Temporarily halts all traffic to a specific ISP or domain if a critical failure threshold is breached.
