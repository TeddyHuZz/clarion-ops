-- Seed data for testing the AI Analysis feature
-- Inserts sample incidents and their corresponding AI RCA results

-- 1. Sample Incidents
INSERT INTO incident_events (time, service_name, severity, status, raw_payload) VALUES
  (NOW() - INTERVAL '2 hours', 'api-gateway', 'critical', 'Resolved',
   '{"alertname": "HighCPU", "labels": {"pod": "api-gateway-7b9f4d6c8-xk2pq", "namespace": "production"}, "annotations": {"summary": "CPU usage exceeded 90% for 5 minutes"}}'),
  (NOW() - INTERVAL '1 hour', 'payment-service', 'warning', 'Manual Intervention',
   '{"alertname": "HighLatency", "labels": {"pod": "payment-svc-5c8d7b9f2-mn4rt", "namespace": "production"}, "annotations": {"summary": "P99 latency exceeded 500ms threshold"}}'),
  (NOW() - INTERVAL '30 minutes', 'user-service', 'critical', 'AI Investigating',
   '{"alertname": "PodCrashLoop", "labels": {"pod": "user-svc-3f6a8c2e1-jw7kp", "namespace": "production"}, "annotations": {"summary": "Pod restarting 10+ times in last 5 minutes"}}'),
  (NOW() - INTERVAL '15 minutes', 'order-service', 'warning', 'Verifying',
   '{"alertname": "ConnectionPoolExhausted", "labels": {"pod": "order-svc-9d2e5f7a3-qt8xn", "namespace": "production"}, "annotations": {"summary": "Database connection pool at 100% capacity"}}'),
  (NOW() - INTERVAL '5 minutes', 'notification-service', 'info', 'Open',
   '{"alertname": "QueueBacklog", "labels": {"pod": "notify-svc-1a4b7c9e2-vz5mp", "namespace": "production"}, "annotations": {"summary": "Message queue depth exceeds 1000 messages"}}');

-- 2. Sample AI Analysis Results
INSERT INTO ai_analysis (incident_id, root_cause_summary, confidence_score, recommended_action, pod_logs, analyzed_at) VALUES
  (
    1,
    'CPU spike caused by a memory leak in the request parsing middleware. The api-gateway pod consumed excessive CPU cycles attempting to process malformed JSON payloads from a batch of corrupted requests. Connection pool saturation followed as worker threads were blocked on CPU-bound parsing operations.',
    92,
    'restart',
    '2026-04-11T22:00:01Z INFO  [api-gateway] Starting request handler...
2026-04-11T22:00:15Z INFO  [api-gateway] Connected to Redis cache at redis://cache:6379
2026-04-11T22:05:22Z WARN  [api-gateway] Request parsing took 2.3s (threshold: 500ms)
2026-04-11T22:05:23Z WARN  [api-gateway] Request parsing took 3.1s (threshold: 500ms)
2026-04-11T22:05:45Z ERROR [api-gateway] JSON parse error: unexpected token at position 4096
2026-04-11T22:05:45Z ERROR [api-gateway] JSON parse error: unexpected token at position 8192
2026-04-11T22:06:01Z WARN  [api-gateway] Worker thread pool exhausted (0/50 available)
2026-04-11T22:06:15Z ERROR [api-gateway] Health check failed: connection timeout
2026-04-11T22:06:30Z WARN  [api-gateway] Upstream connection refused: payment-service:8080
2026-04-11T22:07:00Z ERROR [api-gateway] OOM killer invoked for process PID 1847
2026-04-11T22:07:01Z INFO  [api-gateway] Pod restarting (attempt 1/5)',
    NOW() - INTERVAL '1 hour 55 minutes'
  ),
  (
    2,
    'Increased database query latency due to a missing index on the transactions table. The payment-service experienced a 3x increase in query time after a recent schema migration added a new column without updating the query planner statistics. The P99 latency spike correlates with the deployment of the schema change at 22:00 UTC.',
    72,
    'escalate',
    '2026-04-11T23:00:01Z INFO  [payment-svc] Database connection pool initialized (min: 5, max: 50)
2026-04-11T23:00:15Z INFO  [payment-svc] Schema migration v2.4.1 applied successfully
2026-04-11T23:01:30Z WARN  [payment-svc] Query took 1.2s: SELECT * FROM transactions WHERE merchant_id = $1
2026-04-11T23:02:45Z WARN  [payment-svc] Query took 2.8s: SELECT * FROM transactions WHERE merchant_id = $1
2026-04-11T23:03:00Z ERROR [payment-svc] Connection pool timeout after 30s
2026-04-11T23:03:15Z WARN  [payment-svc] Retry attempt 3 for merchant payment #48291
2026-04-11T23:04:00Z ERROR [payment-svc] Payment processing timeout for order #48291
2026-04-11T23:04:30Z WARN  [payment-svc] Circuit breaker OPEN for transactions table',
    NOW() - INTERVAL '55 minutes'
  ),
  (
    3,
    'The user-service pod entered a crash loop due to an incompatible dependency version. The latest deployment introduced grpc v1.62 which conflicts with the existing protobuf v4.x runtime. The pod fails immediately on startup with a symbol resolution error in the grpc stub initialization.',
    95,
    'rollback',
    '2026-04-11T23:30:01Z INFO  [user-svc] Container starting...
2026-04-11T23:30:02Z INFO  [user-svc] Loading configuration from /etc/user-svc/config.yaml
2026-04-11T23:30:03Z INFO  [user-svc] Connecting to PostgreSQL at pg-cluster:5432
2026-04-11T23:30:04Z INFO  [user-svc] Database connection established
2026-04-11T23:30:05Z ERROR [user-svc] Failed to initialize gRPC server: symbol lookup error
2026-04-11T23:30:05Z ERROR [user-svc]   undefined symbol: _ZNK6google8protobuf7Message11GetTypeNameB5cxx11Ev
2026-04-11T23:30:05Z ERROR [user-svc]   Expected: libprotobuf.so.32 (protobuf 4.x)
2026-04-11T23:30:05Z ERROR [user-svc]   Found:    libprotobuf.so.55 (protobuf 5.x)
2026-04-11T23:30:05Z FATAL [user-svc] Cannot start: grpc dependency mismatch
2026-04-11T23:30:06Z INFO  [kubelet] Container user-svc exited with code 1
2026-04-11T23:30:11Z INFO  [kubelet] Back-off restarting failed container (attempt 1)
2026-04-11T23:30:16Z INFO  [kubelet] Back-off restarting failed container (attempt 2)
2026-04-11T23:31:00Z INFO  [kubelet] Back-off restarting failed container (attempt 10)',
    NOW() - INTERVAL '25 minutes'
  ),
  (
    4,
    'Connection pool exhaustion in the order-service was triggered by a downstream timeout cascade. The inventory-service became unresponsive due to a lock contention issue on the stock_levels table, causing all order-service connections to remain open while waiting for responses. The pool reached maximum capacity within 3 minutes.',
    88,
    'restart',
    '2026-04-11T23:45:01Z INFO  [order-svc] Processing order #ORD-29384
2026-04-11T23:45:02Z INFO  [order-svc] Calling inventory-service for stock check
2026-04-11T23:45:05Z WARN  [order-svc] Inventory response slow: 3.2s
2026-04-11T23:45:10Z WARN  [order-svc] Inventory response slow: 8.1s
2026-04-11T23:45:30Z ERROR [order-svc] Inventory timeout after 30s (attempt 1)
2026-04-11T23:45:30Z ERROR [order-svc] Inventory timeout after 30s (attempt 2)
2026-04-11T23:46:00Z WARN  [order-svc] Connection pool utilization: 45/50
2026-04-11T23:46:30Z ERROR [order-svc] Connection pool exhausted (50/50)
2026-04-11T23:46:30Z ERROR [order-svc] All connections held waiting for inventory-service
2026-04-11T23:47:00Z FATAL [order-svc] Health check failed: pool exhausted',
    NOW() - INTERVAL '10 minutes'
  );

-- 3. Sample Incident Logs (audit trail)
INSERT INTO incident_logs (incident_id, message, time) VALUES
  (1, 'AI Root Cause Analysis started.', NOW() - INTERVAL '2 hours'),
  (1, 'AI confidence threshold met. Initiating automated restart to last known stable commit.', NOW() - INTERVAL '1 hour 55 minutes'),
  (1, 'Rollback executed. Starting post-remediation health verification.', NOW() - INTERVAL '1 hour 50 minutes'),
  (1, 'Post-remediation verification passed. All health checks green.', NOW() - INTERVAL '1 hour 30 minutes'),
  (2, 'AI Root Cause Analysis started.', NOW() - INTERVAL '1 hour'),
  (2, 'AI confidence too low (72%). Escalating to human operator.', NOW() - INTERVAL '55 minutes'),
  (3, 'AI Root Cause Analysis started.', NOW() - INTERVAL '30 minutes'),
  (3, 'AI confidence threshold met. Initiating automated rollback to last known stable commit.', NOW() - INTERVAL '25 minutes'),
  (4, 'AI Root Cause Analysis started.', NOW() - INTERVAL '15 minutes'),
  (4, 'AI confidence threshold met. Initiating automated restart.', NOW() - INTERVAL '10 minutes');
