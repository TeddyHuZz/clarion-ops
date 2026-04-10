-- AI Analysis Storage for Incident Root Cause Analysis
-- Stores Groq RCA results (summary, confidence, recommended action, and raw pod logs)
-- Target: PostgreSQL with TimescaleDB extension enabled

-- 1. Create the ai_analysis table
CREATE TABLE IF NOT EXISTS ai_analysis (
    id                  SERIAL PRIMARY KEY,
    incident_id         INTEGER         NOT NULL,
    root_cause_summary  TEXT            NOT NULL,
    confidence_score    INTEGER         NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    recommended_action  TEXT            NOT NULL,
    pod_logs            TEXT,
    analyzed_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- Note: incident_events uses composite PK (time, id), so we use a non-FK reference
    -- Application-level integrity is enforced via the incidents API
    CONSTRAINT chk_incident_id_positive CHECK (incident_id > 0)
);

-- 2. Index for fast incident lookups
CREATE INDEX IF NOT EXISTS idx_ai_analysis_incident_id
ON ai_analysis (incident_id);

-- 3. Unique constraint: one AI analysis per incident
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analysis_incident_unique
ON ai_analysis (incident_id);
