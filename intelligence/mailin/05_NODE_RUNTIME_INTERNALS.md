---
label: Runtime & V8 Internals
type: playbook
icon: Cpu
---

## Q: Node.js Event Loop Saturation
How do you distinguish between true CPU exhaustion and Event Loop saturation in a high-throughput environment?

### The Trap Response
"I will monitor the overall CPU utilization of the Kubernetes pod using Prometheus/Grafana."

### Why it fails
A node might demonstrate moderate overall CPU utilization but high "Event Loop Blocked Time." Synchronous, CPU-intensive operations (like RSA signing for DKIM) executing on the main thread paralyze the loop while other CPU cores sit idle. Standard metrics won't reveal the specific bottleneck in the libuv reactor pattern.

### Optimal Staff Response
I would utilize **eBPF (extended Berkeley Packet Filter)** instrumentation at the kernel level. By attaching uprobes to `uv__io_poll()`, I can mathematically calculate the exact duration the event loop is blocked by synchronous execution, ignoring benign idle time. 

---

## Q: V8 GC Premature Promotion
How do you mitigate P99 latency spikes caused by garbage collection when processing massive JSON payloads?

### The Trap Response
"I will increase the total memory limit of the container to give V8 more heap space."

### Why it fails
Increasing total heap doesn't prevent "premature promotion." If the New Space (Young Generation) is too small, it fills faster than the Scavenge collector can clear it, incorrectly promoting short-lived objects to the Old Space and triggering expensive Mark-and-Sweep pauses.

### Optimal Staff Response
I would aggressively tune the **`--max-semi-space-size`** flag (e.g., to 64MB or 128MB). This expands the New Space, giving the Scavenger enough breathing room to discard short-lived objects before they pollute the Old Space, thus eliminating major GC latency spikes.

---

## Q: Boundary Crossing & C++ Addons
When should you offload a task to a Native C++ Addon (N-API) vs. using Worker Threads?

### The Trap Response
"C++ is always faster, so any complex calculation should be moved to an addon."

### Why it fails
Crossing the boundary between V8 and C++ carries a marshaling cost. For trivial tasks, the overhead of translating and copying data structures across the memory boundary makes the native implementation slower than pure JavaScript.

### Optimal Staff Response
Native Addons are reserved for sustained, CPU-heavy blocks (e.g., SHA-256 hashing or custom cryptographic signatures) where performance gains outweigh marshaling latency. Worker Threads are preferred for parallelizing pure JavaScript logic where SharedArrayBuffer can minimize memory cloning overhead.
