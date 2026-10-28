-- Server-side login sessions (cookie holds only a random id; we store its hash)
-- and checkout orders the server created, so the webhook never trusts client data.

CREATE TABLE IF NOT EXISTS store_sessions (
  id_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  global_name TEXT NOT NULL DEFAULT '',
  avatar TEXT,
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS store_sessions_discord_id_idx ON store_sessions (discord_id);

CREATE TABLE IF NOT EXISTS pending_orders (
  transaction_id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  sku_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
