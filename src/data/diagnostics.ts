import type { DiagnosticItem } from '../types/index.ts';

export const DIAGNOSTICS_PLAYBOOK: DiagnosticItem[] = [
  {
    q: "A Node.js service has a memory leak. You cannot restart it. How do you find the root cause?",
    trap: "I will trigger a full Heap Snapshot using `v8.getHeapSnapshot()` to analyze in Chrome DevTools.",
    trapWhy: "Taking a full heap snapshot freezes the V8 isolate. For a 2GB heap, this stops the event loop for 5-10s. Health checks fail, and load balancers drop the node.",
    optimal: "Securely tunnel into the inspector port. Use the V8 Sampling Heap Profiler (sub-1% overhead). Alternatively, use Node.js diagnostics channels to track active handles, looking for unbounded arrays in closures or uncleared `EventEmitter` listeners."
  },
  {
    q: "Explain the exact execution order of: `setTimeout`, `setImmediate`, `Promise.then`, and `process.nextTick`.",
    trap: "Promises go first, then timeouts, then setImmediate.",
    trapWhy: "Lacks precision. The exact microtask queues dictate system behavior under extreme load.",
    optimal: "1. `process.nextTick` executes immediately after current operation. 2. `Promise.then` (Microtasks) execute after nextTick queue is drained. 3. `setTimeout` executes in the Timers phase. 4. `setImmediate` executes in the Check phase. Inside an I/O callback, `setImmediate` ALWAYS executes before `setTimeout`."
  },
  {
    q: "Design an Idempotency mechanism for the Email Send API to prevent double-charging users on network retries.",
    trap: "I will check the Postgres database to see if an email with that content was sent recently before inserting.",
    trapWhy: "Querying a relational DB for every single API request destroys latency SLAs and melts the database.",
    optimal: "1. Require clients to send an `Idempotency-Key` header. 2. Attempt to `SETNX` (Set if Not eXists) the key in Redis with a 24h TTL. 3. If `SETNX` returns 1, process it. If 0, return the cached previous response. Guarantees sub-millisecond atomicity."
  }
];
