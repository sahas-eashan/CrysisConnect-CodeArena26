-- Durable shared hazard state. Transactions lock the singleton row before each update.
-- The JSONB format is versioned, retains evidence/history, and is shared across server instances.
-- Run once against DATABASE_URL; this migration does not change the existing application tables.
CREATE TABLE IF NOT EXISTS hazard_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  payload JSONB NOT NULL CHECK (payload->>'version' = '1'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
