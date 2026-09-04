-- Store order / webhook ledger. Run against the game Postgres.
-- The website does not create the players table.

CREATE TABLE IF NOT EXISTS store_orders (
  id                    BIGSERIAL PRIMARY KEY,
  provider              TEXT NOT NULL DEFAULT 'lemonsqueezy',
  provider_event_id     TEXT NOT NULL,
  event_name            TEXT NOT NULL,
  lemon_store_id        INTEGER,
  lemon_order_id        TEXT,
  lemon_subscription_id TEXT,
  lemon_variant_id      TEXT,
  sku_key               TEXT,
  discord_id            TEXT NOT NULL,
  player_id             INTEGER REFERENCES players(id),
  effect                TEXT NOT NULL,
  gold_delta            INTEGER NOT NULL DEFAULT 0,
  payload               JSONB NOT NULL,
  processed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS store_orders_discord_id_idx ON store_orders (discord_id);
CREATE INDEX IF NOT EXISTS store_orders_order_id_idx ON store_orders (lemon_order_id);
