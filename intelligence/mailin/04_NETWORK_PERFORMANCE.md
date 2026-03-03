---
label: Kernel & TCP/IP Tuning
type: map
icon: Zap
data:
  - id: somaxconn
    title: net.core.somaxconn
    tech: Socket Queue
    bottleneck: Handshake Drops
    scenario: High-throughput SMTP handshakes exceeding default listening queue (128).
    code: |
      # Increase queued connection requests bound for listening sockets
      sysctl -w net.core.somaxconn=65535
  - id: port_range
    title: Local Port Range
    tech: net.ipv4.ip_local_port_range
    bottleneck: Ephemeral Port Exhaustion
    scenario: Dispatching millions of emails starves the default port range.
    code: |
      # Maximize range to approx 64,500 ports
      sysctl -w net.ipv4.ip_local_port_range="1024 65535"
  - id: time_wait
    title: TCP TIME_WAIT Reuse
    tech: net.ipv4.tcp_tw_reuse
    bottleneck: Port Starvation
    scenario: Connections staying in TIME_WAIT for 60s, limiting outbound velocity.
    code: |
      # Recycles sockets in TIME_WAIT state safely
      sysctl -w net.ipv4.tcp_tw_reuse=1
      sysctl -w net.ipv4.tcp_fin_timeout=15
---

# Advanced TCP/IP Tuning for High Concurrency

Processing hundreds of millions of requests necessitating bypassing default Linux kernel constraints.

## Tuning Strategy
- **File Descriptors**: `fs.file-max` is tuned to 2,097,152 to support massive TCP socket counts.
- **Congestion Control**: Uses BBR (Bottleneck Bandwidth and RTT) to maximize throughput and minimize buffer bloat.
- **TCP Fast Open**: `net.ipv4.tcp_fastopen = 3` allows data transmission during the initial SYN packet phase.
