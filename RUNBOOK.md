# Store runbook

## Secrets

Keep Discord client secret, session secret, database URL, Paddle API key, and Paddle webhook secret in the host secret manager. Never commit `.env`. On Vercel, never use `-` as a placeholder — the app treats it as unset.

Rotate `PADDLE_WEBHOOK_SECRET` in the Paddle dashboard (notification destination), then update the host env, then redeploy. Old signatures fail until both sides match.

Rotate `SESSION_SECRET` logs everyone out.

## Catalog pause

Archive or unpublish the four Paddle prices. Existing `/buy/:sku` still renders; checkout fails closed if the API key or price ids are cleared.

Live price ids:

- `PADDLE_PRICE_GOLD_10=pri_01m1vqmtydg3hrzxhsecae8d9v`
- `PADDLE_PRICE_GOLD_25=pri_01m1vqmv2z51ehpf7f1bcd01jf`
- `PADDLE_PRICE_GOLD_50=pri_01m1vqmv7e7v51nja2mdcr7bgt`
- `PADDLE_PRICE_GOLD_100=pri_01m1vqmvby50aw445v47wn7k16`

## Schema

```bash
npm run migrate
```

Applies every `sql/*.sql` file in order on `DATABASE_URL` (the game Postgres). Does not create `players`. Order rows use `provider = 'paddle'`. Columns named `lemon_*` store Paddle transaction / price ids for compatibility with the existing table.

## First-purchase double

`store_first_purchase` records one Discord id after the first successful Gold Bar grant. That grant writes **double** catalog Gold Bars. Later grants are catalog amounts. Refunding that original grant deletes the row so the bonus can apply again. Patron is recomputed from lifetime `gold_delta` (tier 1 at 2,600).

Reset by hand:

```sql
DELETE FROM store_first_purchase WHERE discord_id = :snowflake;
```

## Inspect grants

```sql
SELECT processed_at, event_name, sku_key, discord_id, effect, gold_delta, lemon_order_id
FROM store_orders
ORDER BY id DESC
LIMIT 50;

SELECT discord_id, provider_event_id, used_at
FROM store_first_purchase
WHERE discord_id = :snowflake;

SELECT discord_id, credits, bonds, gold_bars, marks, subscription_active, subscription_expires_at
FROM players
WHERE discord_id = :snowflake;
```

`error_no_player` after a paid webhook: the buyer paid without a `players` row. They should run `/disgrowth`. Do not insert a stub row from the store (starting Credits would be skipped). After they exist, resend the event from the Paddle dashboard.

## Health

`GET /healthz` → `{ "ok": true, "db": "up" | "down", "oauth": bool, "checkout": bool, "missing": [] }`. No secrets. If `db` is down on the VPS, the store is ignoring `DATABASE_URL` or Postgres is down — localhost is valid here. If `checkout` is false, fix Paddle env (`PADDLE_CLIENT_TOKEN` or `PADDLE_API_KEY`, webhook secret, price ids) and restart the store unit.

## Discord bot (other repo)

Point shop Link buttons at this origin, not raw Paddle URLs:

```
STORE_CHECKOUT_GOLD_10={{STORE_ORIGIN}}/buy/gold-10
STORE_CHECKOUT_GOLD_25={{STORE_ORIGIN}}/buy/gold-25
STORE_CHECKOUT_GOLD_50={{STORE_ORIGIN}}/buy/gold-50
STORE_CHECKOUT_GOLD_100={{STORE_ORIGIN}}/buy/gold-100
```

## Paddle dashboard

Catalog products already exist in the live account. Do **not** delete them, the checkout domain, the client-side token, or the webhook destination.

You still need:

1. **Update the existing** notification destination URL to `https://{{STORE_ORIGIN}}/api/webhooks/paddle` (do not create a second destination).
2. Subscribe to `transaction.completed`, `customer.created`, `customer.updated`, and `adjustment.updated`. Do **not** subscribe to `transaction.updated`.
3. In Checkout > Checkout settings, set the **default payment link** to the live store origin (an approved domain, not localhost). Overlay success URL is `/welcome`.
4. `PADDLE_ENV=production` plus live API key, live client token (`live_…`), webhook signing secret, and live price ids on the host.
5. Default payment link and an **approved** checkout domain must be `disgrowth.net`. `disgrowth.vercel.app` is leftover and cannot grant Gold Bars (it cannot see VPS Postgres).

## HTTPS / nginx

`deploy/nginx/disgrowth.conf` is the origin config (Cloudflare origin certs at `/etc/ssl/cloudflare/disgrowth.pem`). Port 80 still **proxies** to Node: live traffic arrives as HTTP (Flexible SSL or grey-cloud DNS), and a 301 to HTTPS loops the site. After the Cloudflare dashboard is Full (strict) **and** the A record is orange-cloud, switch `:80` to `return 301 https://disgrowth.net$request_uri;`. `ngx_http_realip_module` applies `CF-Connecting-IP` only when the TCP peer is in Cloudflare's published ranges; Node rates limits by `req.ip` (one trusted hop) and ignores a client-supplied `CF-Connecting-IP`. Firewall origin `:80`/`:443` to Cloudflare IPs once orange-cloud is on.

The ticker on each HTML page is an in-process snapshot (30s TTL, one Postgres query for the process). Pages do not query `price_history` per visitor.

## Security events

Failed Discord logins, rejected Paddle webhook signatures, and checkout failures log as JSON lines (`oauth_callback_failed`, `paddle_webhook_rejected`, `paddle_checkout_failed`). systemd captures stdout/stderr for `disgrowth-store`. There is no public Swagger/GraphQL, no file upload, and no password database.
