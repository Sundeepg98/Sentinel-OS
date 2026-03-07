---
label: "Kernel Performance Tuning"
type: "markdown"
icon: "Cpu"
---

# High-Throughput Network Performance

Extracting maximum capacity from bare-metal hardware requires bypassing conservative Linux kernel defaults.

## Tuning Parameters
- **fs.file-max**: Tuned to 2,097,152 to support massive concurrent file descriptors (one per TCP socket).
- **net.ipv4.tcp_max_syn_backlog**: Limits unacknowledged SYN requests; tuned to 65535 to defend against SYN floods.
- **BBR Congestion Control**: Focusing on throughput and buffer bloat instead of legacy packet loss metrics (CUBIC).
- **TCP Fast Open**: (`net.ipv4.tcp_fastopen = 3`) shaves milliseconds off establishment during initial SYN packet phase.
