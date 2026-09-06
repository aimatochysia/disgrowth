-- First Gold Bar purchase bonus (double once per Discord id). Resettable.

CREATE TABLE IF NOT EXISTS store_first_purchase (
  discord_id          TEXT PRIMARY KEY,
  provider_event_id   TEXT NOT NULL,
  used_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
