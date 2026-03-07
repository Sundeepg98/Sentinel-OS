---
label: "Role Benchmarks & Drills"
type: "markdown"
icon: "Swords"
---

## Q: Distributed State & CAP Theorem
How does Mailin's architecture handle Consistency vs. Availability during a network partition?

### The Trap Response
"We use a distributed database like Cassandra to ensure high availability so that emails are always sent."

### Why it fails
In a credit-based system, **Consistency (C)** is prioritized over **Availability (A)**. An inconsistent system could send duplicate emails during a partition, damaging IP reputation and violating billing integrity.

### Optimal Staff Response
I prioritize **Consistency and Partition Tolerance (CP)** for stateful operations (credit deduction, idempotency checks). We utilize PostgreSQL with optimistic locking. For the message bus, we use `min.insync.replicas` to ensure message persistence across brokers before acknowledging, guaranteeing state integrity.

---

## Q: Scaling Leaf Services
How do you scale SMTP workers without centralizing all state in a bottleneck database?

### The Trap Response
"I will put a standard Load Balancer in front of the services and use sticky sessions."

### Why it fails
Sticky sessions are brittle for background workers. If a node fails, the "stickiness" is lost, and the new node won't have the context of the active rate-limit counter.

### Optimal Staff Response
I would implement **Consistent Hashing** at the Orchestrator level. Mapping `sender_id` to a virtual ring ensures traffic routes to the same Leaf instance. This enables local in-memory caching of rate limits and connection pools, reducing database pressure by 80-90% while allowing minimal rebalancing overhead.
---

# Engineering Recruitment Pipeline
Recruitment focuses rigidly on system design and low-level runtime knowledge. 
- **Evaluation Stages**: Asynchronous screening (HireVue) -> Timed Algorithmic Assessment -> Intensive Technical Review (Event Loop, CAP, Memory Management).
- **Domain Specific Hurdle**: Candidates must articulate mechanics of SMTP, DNS, and cryptographic reputation management (DKIM/SPF).
