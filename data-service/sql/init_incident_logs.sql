-- Audit log entries for incident lifecycle events.
-- This table stores free-text log messages attached to specific incidents.

CREATE TABLE IF NOT EXISTS incident_logs (
    id              SERIAL PRIMARY KEY,
    time            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    incident_id     INTEGER         NOT NULL,
    message         TEXT            NOT NULL,
    -- Note: incident_events uses composite PK (time, id), so we skip the FK constraint.
    -- Application-level integrity is enforced via the incidents API.
    CONSTRAINT chk_incident_logs_id_positive CHECK (incident_id > 0)
);

-- Index for fast incident lookups
CREATE INDEX IF NOT EXISTS idx_incident_logs_incident_id
ON incident_logs (incident_id);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS idx_incident_logs_time
ON incident_logs (time DESC);
