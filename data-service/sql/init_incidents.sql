-- TimescaleDB Initialization Script for Incident Events
-- Target: PostgreSQL with TimescaleDB extension enabled

-- 1. Create the base incident_events table
CREATE TABLE IF NOT EXISTS incident_events (
    id              SERIAL,
    time            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    service_name    TEXT              NOT NULL,
    severity        TEXT              NOT NULL,
    status          TEXT              NOT NULL DEFAULT 'Open',
    raw_payload     JSONB,
    PRIMARY KEY (time, id)
);

-- 2. Transform into a TimescaleDB Hypertable
-- Partitions data by time for efficient ingestion and range queries
SELECT create_hypertable('incident_events', 'time', if_not_exists => TRUE);

-- 3. Optimize for common query patterns
-- Index on status for filtering open/active incidents
CREATE INDEX IF NOT EXISTS idx_incident_events_status
ON incident_events (status, time DESC);

-- Index on service_name for per-service incident lookups
CREATE INDEX IF NOT EXISTS idx_incident_events_service
ON incident_events (service_name, time DESC);

-- Index on severity for filtering by criticality
CREATE INDEX IF NOT EXISTS idx_incident_events_severity
ON incident_events (severity, time DESC);

-- 4. GIN index on raw_payload for JSONB containment queries
CREATE INDEX IF NOT EXISTS idx_incident_events_payload
ON incident_events USING GIN (raw_payload);
