# Store runbook

## Secrets

Keep Discord client secret, session secret, database URL, and Lemon Squeezy webhook secret in the host secret manager. Never commit `.env`.

Rotate `LEMONSQUEEZY_WEBHOOK_SECRET` in the Lemon Squeezy dashboard, then update the host env, then redeploy. Old signatures fail until both sides match.

Rotate `SESSION_SECRET` logs everyone out.

## Catalog pause

Hide or unpublish the three Lemon Squeezy products. Existing `/buy/:sku` still renders; checkout redirect fails closed if variant ids are cleared.

## Schema

```bash
npm run migrate
```

Applies `sql/001_store_orders.sql` on `DATABASE_URL` (the game Postgres). Does not create `players`.

## Inspect grants

```sql
SELECT processed_at, event_name, sku_key, discord_id, effect, gold_delta, lemon_order_id
FROM store_orders
ORDER BY id DESC
LIMIT 50;

SELECT discord_id, credits, bonds, gold_bars, marks, subscription_active, subscription_expires_at
FROM players
WHERE discord_id = :snowflake;
```

`error_no_player` after a paid webhook: the buyer paid without a `players` row. They should run `/disgrowth`. Do not insert a stub row from the store (starting Credits would be skipped). After they exist, resend the event from the Lemon Squeezy dashboard.

## Health

`GET /healthz` → `{ "ok": true, "db": "up" | "down" }`. No secrets.

## Discord bot (other repo)

Point shop Link buttons at this origin, not raw Lemon Squeezy URLs:

```
LEMONSQUEEZY_CHECKOUT_STARTER={{STORE_ORIGIN}}/buy/gold-starter
LEMONSQUEEZY_CHECKOUT_PACK={{STORE_ORIGIN}}/buy/gold-pack
LEMONSQUEEZY_CHECKOUT_PASS={{STORE_ORIGIN}}/buy/accountant-pass
```
