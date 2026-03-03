---
label: Deep Systems Playbook
type: playbook
icon: SearchCode
---

## Q: V8 Memory Leaks & Premature Promotion
How do you diagnose and mitigate severe latency spikes in a high-throughput Node.js microservice handling massive JSON payloads?

### The Trap Response
"I will capture a full heap snapshot using Chrome DevTools (`node --heap-prof`) in production and analyze the retaining paths."

### Why it fails
Taking a full heap snapshot freezes the V8 isolate. In an environment processing hundreds of requests per second, stopping the event loop for multiple seconds will cause health checks to fail, leading Kubernetes to kill the pod. Furthermore, the issue might not be a genuine leak, but "premature promotion" of short-lived objects flooding the Old Space.

### Optimal Staff Response
The latency spikes are likely caused by "premature promotion." When the New Space (managed by the fast Scavenger) is too small, it fills faster than it can be cleared. Transient objects are incorrectly promoted to the Old Space, flooding it with garbage and triggering slow, latency-inducing Mark-and-Sweep GC pauses.

I would mitigate this by aggressively tuning the `--max-semi-space-size` flag (e.g., to 64MB or 128MB). This gives the Scavenger enough breathing room to correctly identify and discard short-lived objects before they pollute the Old Space. While this increases the Resident Set Size (RSS), it drastically reduces CPU usage and eliminates P99 latency spikes. For monitoring event loop blockage, I would utilize eBPF uprobes on `uv__io_poll()` to measure exact blockage duration without application overhead.

---

## Q: gRPC Load Balancing in Kubernetes
Your Node.js gRPC clients are connected to a Kubernetes service, but you notice that only a single backend pod is receiving all the traffic while the replica pods sit completely idle. How do you fix this?

### The Trap Response
"I will increase the number of replicas and ensure the Kubernetes Service is configured correctly as a ClusterIP or NodePort."

### Why it fails
Kubernetes ClusterIP services function as Layer 4 (connection-level) load balancers. Because gRPC relies on HTTP/2, it establishes a single, persistent, long-lived TCP connection, aggressively multiplexing thousands of concurrent requests over that single socket. The L4 proxy routes the initial connection to one pod, and all subsequent requests follow that connection, entirely bypassing the load balancer.

### Optimal Staff Response
We must shift from connection-level balancing to Layer 7 (request-level) balancing. 

I would configure the Kubernetes Service as a **Headless Service** (setting `clusterIP: None`). This bypasses the internal proxy and allows the cluster's DNS to return the complete array of IP addresses for all healthy pods directly to the client. I would then configure the Node.js gRPC client with a `round_robin` load balancing policy and set the `MAX_CONNECTION_AGE` parameter to force the client to periodically sever connections and re-resolve the service DNS, allowing it to discover newly scaled pods.

Alternatively, integrating a service mesh like Linkerd would automatically intercept the multiplexed stream and perform L7 load balancing without requiring modification to the underlying Node.js application code.
