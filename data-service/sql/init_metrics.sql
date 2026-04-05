-- TimescaleDB Initialization Script for Clarion Ops Metrics
-- Target: PostgreSQL with TimescaleDB extension enabled

-- 1. Create the base metrics table
CREATE TABLE IF NOT EXISTS metric_snapshots (
    time            TIMESTAMPTZ       NOT NULL,
    namespace       TEXT,
    pod_name        TEXT,
    cpu_usage       DOUBLE PRECISION, -- Standard FLOAT in PG
    memory_bytes    BIGINT,
    restart_count   INTEGER
);

-- 2. Transform into a TimescaleDB Hypertable
-- This partitions the data by time for efficient ingestion and retention
SELECT create_hypertable('metric_snapshots', 'time', if_not_exists => TRUE);

-- 3. Optimize for Frontend Filtering
-- Indexing namespace and pod_name allows for O(log n) lookups when 
-- filtering the dashboard for specific environments or resources.
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_namespace_pod 
ON metric_snapshots (namespace, pod_name, time DESC);

-- 4. Set Retention Policy (Optional but Recommended)
-- Automatically drop data older than 30 days to manage storage costs
-- SELECT add_retention_policy('metric_snapshots', INTERVAL '30 days');
