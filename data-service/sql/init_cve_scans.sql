-- Create the security vulnerability tracking table for audit logging
CREATE TABLE IF NOT EXISTS cve_scans (
    id SERIAL PRIMARY KEY,
    time TIMESTAMPTZ NOT NULL,
    commit_hash TEXT NOT NULL,
    cve_id TEXT NOT NULL,
    severity TEXT NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
    package_name TEXT NOT NULL,
    fixed_version TEXT
);

-- Index for high-speed joins with deployment_events
CREATE INDEX IF NOT EXISTS idx_cve_commit_hash ON cve_scans (commit_hash);

-- Index for time-range filtering in security dashboards
CREATE INDEX IF NOT EXISTS idx_cve_time ON cve_scans (time DESC);
