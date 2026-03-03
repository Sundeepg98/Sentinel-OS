import type { ArchitecturePattern } from '../types/index.ts';

export const ARCHITECTURE_PATTERNS: ArchitecturePattern[] = [
  {
    id: 'ingest',
    title: 'Atomic Rate Limiting',
    tech: 'Fastify + Redis Cluster',
    bottleneck: 'Race Conditions at 20k RPS',
    scenario: 'Standard `GET -> Calculate -> SET` logic suffers from race conditions under extreme concurrency, bypassing rate limits.',
    code: `-- Optimal Solution: Redis Lua Script (Atomic)
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('get', key) or "0")

if current + 1 > limit then
  return 0 -- Reject (429 Too Many Requests)
else
  redis.call('INCR', key)
  redis.call('EXPIRE', key, 1) -- 1s Sliding Window
  return 1 -- Accept
end`
  },
  {
    id: 'network',
    title: 'Binary gRPC Protocols',
    tech: 'gRPC + Protocol Buffers',
    bottleneck: 'JSON Serialization Overhead',
    scenario: 'Mailin parses millions of multipart MIME bodies. Standard JSON APIs introduce CPU-heavy stringification latency.',
    code: `// Optimal Solution: Binary Proto Definitions
syntax = "proto3";

message EmailPayload {
  string to = 1;
  string body = 2;
  bytes attachment = 3;
}

service DeliveryService {
  rpc Dispatch(EmailPayload) returns (Status);
}

// Result: 5-10x faster serialization than JSON.stringify()`
  },
  {
    id: 'database',
    title: 'Pessimistic Locking',
    tech: 'PostgreSQL FOR UPDATE',
    bottleneck: 'Balance Double-Spending',
    scenario: 'Two concurrent processes try to deduct email credits from a user. Both read the same balance, resulting in a single deduction.',
    code: `-- Optimal Solution: Row-Level Locking
BEGIN;

-- Lock the row for the specific user
SELECT credits FROM user_accounts 
WHERE user_id = 'user_123' 
FOR UPDATE;

-- Perform calculation in application logic
-- Then update
UPDATE user_accounts 
SET credits = credits - 1 
WHERE user_id = 'user_123';

COMMIT;`
  },
  {
    id: 'queue',
    title: 'Consumer Rebalance Storms',
    tech: 'Apache Kafka',
    bottleneck: 'Pod Restarts Halting Processing',
    scenario: 'If a Node.js worker pod restarts, Kafka pauses ALL consumers in the group to reassign partitions. Processing halts.',
    code: `// Optimal Solution: Static Membership
const kafka = new Kafka({
  clientId: 'mailin-worker',
  brokers: ['kafka-cluster:9092']
});

const consumer = kafka.consumer({ 
  groupId: 'email-delivery-group',
  sessionTimeout: 30000, 
  // Ties consumer to the specific K8s StatefulSet pod ID
  groupInstanceId: process.env.POD_NAME 
});`
  },
  {
    id: 'worker',
    title: 'Consumer Backpressure',
    tech: 'Node.js + BullMQ/KafkaJS',
    bottleneck: 'Downstream Outages & OOM',
    scenario: 'If Gmail throttles Mailin, the consumer pulls messages into V8 memory faster than they can be sent, causing an OOM crash.',
    code: `// Optimal Solution: Dynamic Backpressure
let inFlight = 0;
const MAX_CONCURRENT = 1000;

await consumer.run({
  eachMessage: async ({ topic, message }) => {
    inFlight++;
    
    // Halt fetching from broker
    if (inFlight >= MAX_CONCURRENT) consumer.pause([{ topic }]); 

    await dispatchEmail(message); 
    
    inFlight--;
    // Resume fetching
    if (inFlight < MAX_CONCURRENT) consumer.resume([{ topic }]); 
  },
});`
  }
];
