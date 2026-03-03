---
label: Recruitment & CAP Drills
type: playbook
icon: GraduationCap
---

## Q: Distributed State & CAP Theorem
How does Mailin's architecture handle the trade-off between Consistency and Availability during a network partition in the email dispatch pipeline?

### The Trap Response
"We use a distributed database like Cassandra to ensure high availability so that emails are always sent even if a node fails."

### Why it fails
In a financial or credit-based system (like deducting $1.20 per mailbox), **Consistency (C)** is usually prioritized over **Availability (A)** to prevent double-spending or duplicate dispatches. An available but inconsistent system could send the same email twice during a partition, damaging IP reputation.

### Optimal Staff Response
I prioritize **Consistency and Partition Tolerance (CP)** for stateful operations like credit deduction and idempotency checks. We utilize high-availability PostgreSQL clusters with optimistic locking. During a partition, we prefer to fail a specific dispatch request rather than risk a duplicate send. For the message bus (Kafka), we use a `min.insync.replicas` configuration to ensure that a message is only acknowledged once it is safely persisted across multiple brokers, guaranteeing state integrity before the "Leaf Service" begins processing.

---

## Q: Consistent Hashing in Microservices
How would you scale the "Leaf Services" that handle SMTP connections without centralizing all state in a single bottleneck database?

### The Trap Response
"I will put a standard Load Balancer in front of the services and use sticky sessions."

### Why it fails
Sticky sessions are brittle and don't help with background worker distribution. If a node fails, the "stickiness" is lost, and the new node won't have the context of the active SMTP handshake or rate-limit counter.

### Optimal Staff Response
I would implement **Consistent Hashing** at the Orchestrator level. By mapping `sender_id` or `ip_address` to a virtual ring, we ensure that specific traffic always routes to the same Leaf Service instance. This allows for local in-memory caching of rate limits and connection pools, reducing database pressure by 80-90% while allowing the cluster to scale out horizontally with minimal rebalancing overhead when new pods are added to the Kubernetes cluster.
