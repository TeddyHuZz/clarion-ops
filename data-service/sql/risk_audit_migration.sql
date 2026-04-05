ALTER TABLE deployment_events ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    time TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN'
);

-- Ensure incidents is a hypertable for performance
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM _timescaledb_catalog.hypertable WHERE table_name = 'incidents') THEN
        PERFORM create_hypertable('incidents', 'time');
    END IF;
END $$;
