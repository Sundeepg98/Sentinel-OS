import type { V8InternalSection } from '../types/index.ts';

export const V8_INTERNALS: V8InternalSection[] = [
  {
    category: 'Libuv & The Thread Pool',
    items: [
      {
        title: 'DNS Resolution Blocking',
        desc: 'Mailin makes millions of SMTP connections. `http` and `net` modules use `dns.lookup()`, relying on `getaddrinfo` in the Libuv thread pool (default size 4).',
        impact: 'If 10,000 emails are dispatched to uncached domains simultaneously, all 4 threads block. The entire Node.js event loop stalls.',
        solution: 'Use `dns.resolve()` to make direct async network queries bypassing the thread pool. Maintain an internal LRU cache for MX records. Increase `UV_THREADPOOL_SIZE`.'
      },
      {
        title: 'File System Sync Methods',
        desc: 'Any method ending in `*Sync` (e.g., `fs.readFileSync`) bypasses the thread pool and blocks the main V8 thread.',
        impact: 'A 50MB CSV file uploaded and parsed synchronously freezes the instance for seconds, triggering K8s liveness probe failures.',
        solution: 'Strictly mandate `fs.createReadStream()`. Pipe it through a `stream.Transform` to parse line-by-line, adhering to backpressure.'
      }
    ]
  },
  {
    category: 'Garbage Collection & Memory',
    items: [
      {
        title: 'Scavenger vs. Mark-Sweep',
        desc: 'V8 divides the heap into New Space (collected by the fast Scavenger) and Old Space (collected by the slower Mark-Sweep algorithm).',
        impact: 'Massive JSON payload objects surviving Scavenger get promoted to Old Space. Frequent Mark-Sweep cycles cause "Stop-The-World" pauses, spiking API latency.',
        solution: 'Use stream-based JSON parsers (`stream-json`). Avoid storing large arrays in global/closure scope. Pre-allocate Buffers for raw binary data.'
      },
      {
        title: 'K8s OOM Kills vs V8 Fatal Errors',
        desc: 'K8s limits do not constrain V8. If a pod has a 2GB limit, but V8 sees a 64GB host node, it allocates until the kernel sends SIGKILL.',
        impact: 'Silent container restarts with exit code 137. No crash logs.',
        solution: 'Pass `--max-old-space-size=1536` to align V8 with the container limits, forcing V8 to run GC before the kernel kills the pod.'
      }
    ]
  }
];
