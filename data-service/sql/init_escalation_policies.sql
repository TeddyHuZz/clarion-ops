CREATE TABLE IF NOT EXISTS escalation_policies (
    id              SERIAL PRIMARY KEY,
    service_name    VARCHAR(255) UNIQUE NOT NULL,
    level_1_user    VARCHAR(255),
    level_2_user    VARCHAR(255),
    level_3_user    VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_policies_service_name ON escalation_policies (service_name);
