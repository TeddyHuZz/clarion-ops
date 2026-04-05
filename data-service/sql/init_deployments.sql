-- file: data-service/sql/init_deployments.sql
-- Create the deployment events table for audit logging
CREATE TABLE IF NOT EXISTS deployment_events (
    time TIMESTAMPTZ NOT NULL,
    service_name TEXT NOT NULL,
    commit_hash TEXT NOT NULL,
    author TEXT NOT NULL,
    branch TEXT NOT NULL,
    status TEXT NOT NULL
);

-- Convert to a hypertable partitioned by the 'time' column for historical analysis
-- if_not_exists ensures we don't error if it's already a hypertable
SELECT create_hypertable('deployment_events', 'time', if_not_exists => TRUE);

-- Efficient indexing for service-name lookups and time-series ranges
CREATE INDEX IF NOT EXISTS idx_deployments_service ON deployment_events (service_name, time DESC);
