---
label: Kernel Performance Tuning
type: map
icon: Zap
data:
  - id: port_starvation
    title: Ephemeral Port range
    tech: sysctl net.ipv4.ip_local_port_range
    bottleneck: Outbound Connection Starvation
    scenario: Default port range limiting outbound sockets per IP.
    code: |
      # Maximize range to ~64,500 ports
      sysctl -w net.ipv4.ip_local_port_range="1024 65535"
  - id: socket_velocity
    title: TCP TIME_WAIT Reuse
    tech: net.ipv4.tcp_tw_reuse
    bottleneck: Port Recycling Latency
    scenario: Connections stuck in TIME_WAIT for 60s (fin_timeout).
    code: |
      # Safe recycling of sockets
      sysctl -w net.ipv4.tcp_tw_reuse=1
      sysctl -w net.ipv4.tcp_fin_timeout=15
  - id: connection_backlog
    title: Somaxconn Backlog
    tech: net.core.somaxconn
    bottleneck: Listening Socket Drops
    scenario: Bursty SMTP handshakes exceeding default queue depth (128).
    code: |
      # Increase connection queue depth
      sysctl -w net.core.somaxconn=65535
      sysctl -w net.core.netdev_max_backlog=65535
---

# High-Throughput Network Performance

Extracting maximum capacity from bare-metal hardware requires bypassing conservative Linux kernel defaults.

## Tuning Parameters
- **fs.file-max**: Tuned to 2,097,152 to support massive concurrent file descriptors (one per TCP socket).
- **net.ipv4.tcp_max_syn_backlog**: Limits unacknowledged SYN requests; tuned to 65535 to defend against SYN floods.
- **BBR Congestion Control**: Focusing on throughput and buffer bloat instead of legacy packet loss metrics (CUBIC).
- **TCP Fast Open**: (`net.ipv4.tcp_fastopen = 3`) shaves milliseconds off establishment during initial SYN packet phase.
