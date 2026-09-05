# Store runbook

## Secrets

Keep Discord client secret, session secret, database URL, Paddle API key, and Paddle webhook secret in the host secret manager. Never commit `.env`.

Rotate `PADDLE_WEBHOOK_SECRET` in the Paddle dashboard (notification destination), then update the host env, then redeploy. Old signatures fail until both sides match.

Rotate `SESSION_SECRET` logs everyone out.

## Catalog pause

Archive or unpublish the four Paddle prices. Existing `/buy/:sku` still renders; checkout fails closed if the API key or price ids are cleared.

## Schema

```bash
npm run migrate
```

Applies `sql/001_store_orders.sql` on `DATABASE_URL` (the game Postgres). Does not create `players`. Order rows use `provider = 'paddle'`. Columns named `lemon_*` store Paddle transaction / price ids for compatibility with the existing table.

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

`error_no_player` after a paid webhook: the buyer paid without a `players` row. They should run `/disgrowth`. Do not insert a stub row from the store (starting Credits would be skipped). After they exist, resend the event from the Paddle dashboard.

## Health

`GET /healthz` → `{ "ok": true, "db": "up" | "down" }`. No secrets.

## Discord bot (other repo)

Point shop Link buttons at this origin, not raw Paddle URLs:

```
PADDLE_CHECKOUT_GOLD_10={{STORE_ORIGIN}}/buy/gold-10
PADDLE_CHECKOUT_GOLD_25={{STORE_ORIGIN}}/buy/gold-25
PADDLE_CHECKOUT_GOLD_50={{STORE_ORIGIN}}/buy/gold-50
PADDLE_CHECKOUT_GOLD_100={{STORE_ORIGIN}}/buy/gold-100
```

## Paddle dashboard

1. Create four one-time catalog prices ($10 / $25 / $50 / $100) and put the `pri_…` ids in env.
2. Add a notification destination: `https://{{STORE_ORIGIN}}/api/webhooks/paddle`
3. Subscribe at least to `transaction.completed` and `adjustment.updated`.
4. Set the default payment-link success URL to `https://{{STORE_ORIGIN}}/success`.
5. Use sandbox (`PADDLE_ENV=sandbox`) until go-live, then `PADDLE_ENV=production` and live API key + live price ids.
