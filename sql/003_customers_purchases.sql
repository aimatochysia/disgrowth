-- Paddle customer + purchase mirror (fulfillment). Same Postgres as the game.
-- Do not drop these tables. They are live purchase state.

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  discord_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_discord_id_idx ON customers (discord_id);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);

CREATE TABLE IF NOT EXISTS purchases (
  transaction_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  product_id TEXT NOT NULL,
  status TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  discord_id TEXT,
  sku_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchases_customer_id_idx ON purchases (customer_id);
CREATE INDEX IF NOT EXISTS purchases_discord_id_idx ON purchases (discord_id);
