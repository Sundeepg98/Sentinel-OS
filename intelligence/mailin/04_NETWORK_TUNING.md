---
label: Kernel & Network Tuning
type: map
icon: Zap
data:
  - id: ephemeral_ports
    title: Ephemeral Port Maximization
    tech: sysctl net.ipv4.ip_local_port_range
    bottleneck: Port Exhaustion
    scenario: Supporting millions of daily connections requires expanding the port range.
    code: |
      # High-Throughput Config
      sysctl -w net.ipv4.ip_local_port_range="1024 65535"
  - id: time_wait_reuse
    title: TCP TIME_WAIT Reuse
    tech: sysctl net.ipv4.tcp_tw_reuse
    bottleneck: Outbound Sockets Velocity
    scenario: Connections stuck in TIME_WAIT for 60s limiting new socket creation.
    code: |
      # Safe Recycling
      sysctl -w net.ipv4.tcp_tw_reuse=1
      sysctl -w net.ipv4.tcp_fin_timeout=15
  - id: socket_queue
    title: Connection Queue Tuning
    tech: net.core.somaxconn
    bottleneck: Queued Handshake Drops
    scenario: High-volume SMTP handshakes exceeding default queue depth (128).
    code: |
      # Increase listening socket backlog
      sysctl -w net.core.somaxconn=65535
      sysctl -w net.core.netdev_max_backlog=65535
---

# Advanced TCP/IP Performance Tuning

Processing hundreds of millions of requests necessitates bypassing default Linux kernel constraints.

## Tuning Strategy
*   **File Descriptors:** `fs.file-max` tuned to 2,097,152.
*   **Congestion Control:** Uses BBR (Bottleneck Bandwidth and RTT) to maximize throughput and minimize buffer bloat.
*   **TCP Fast Open:** Allows data transmission during the initial SYN packet phase.
