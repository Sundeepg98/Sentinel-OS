---
label: Kernel TCP/IP Tuning
type: map
icon: Cpu
data:
  - id: somaxconn
    title: net.core.somaxconn
    tech: Kernel Socket Queue
    bottleneck: Dropped Connection Requests
    scenario: High-throughput SMTP handshakes exceeding default listening queue.
    code: |
      # Dictates the max number of queued connection requests bound for a listening socket.
      sysctl -w net.core.somaxconn=65535
  - id: ephemeral_ports
    title: Ephemeral Port Exhaustion
    tech: net.ipv4.ip_local_port_range
    bottleneck: Port Starvation (TIME_WAIT)
    scenario: Dispatching millions of emails starves the ~28k default port range.
    code: |
      # Maximize port range to approx 64,500 available ports per IP
      sysctl -w net.ipv4.ip_local_port_range="1024 65535"
      # Reduce FIN timeout to free ports faster
      sysctl -w net.ipv4.tcp_fin_timeout=15
      # Enable kernel to safely recycle sockets in TIME_WAIT state
      sysctl -w net.ipv4.tcp_tw_reuse=1
  - id: file_descriptors
    title: Global File Descriptors
    tech: fs.file-max
    bottleneck: Socket Creation Failures
    scenario: Because every TCP socket requires a distinct file descriptor, defaults are too low.
    code: |
      # Controls the global limit of open file descriptors
      sysctl -w fs.file-max=2097152
---

# Advanced TCP/IP Tuning for High Concurrency
Processing hundreds of millions of network requests per month necessitates bypassing the default constraints of the underlying Linux operating system. The kernel's networking stack provides hundreds of tunable parameters designed for general-purpose computing. However, for a high-throughput SMTP and HTTP environment handling massive concurrency, these default conservative parameters inevitably become severe performance bottlenecks.
