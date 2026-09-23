# Store runbook

Production runs on the VPS behind nginx and Cloudflare, as the systemd unit `disgrowth-store`, at `https://disgrowth.net`. It shares the game's Postgres with the Discord bot. A Vercel deployment can render pages but cannot reach that database, so it cannot grant Gold Bars.

## Configuration

Production values live in `/opt/disgrowth/store/.env`. `.env.example` lists every key. Never commit real values. Empty strings and placeholders such as `-`, `blank`, or `changeme` are treated as unset.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | Boot | 32+ random characters. Rotating it logs everyone out. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Boot | Same Discord application as the bot. |
| `DATABASE_URL` | Boot | The game Postgres. On the VPS this is `127.0.0.1`, which is correct there. |
| `STORE_ORIGIN` | Checkout | `https://disgrowth.net` |
| `PADDLE_ENV` | Checkout | `production` or `sandbox`. Never inferred. |
| `PADDLE_API_KEY` | Checkout | Server-side transactions and the invoice portal. |
| `PADDLE_WEBHOOK_SECRET` | Checkout | The notification destination's `endpoint_secret_key`. |
| `PADDLE_CLIENT_TOKEN` | Checkout | `live_…` with `production`, `test_…` with `sandbox`. |
| `PADDLE_PRICE_GOLD_10` … `_100` | Checkout | See the live catalog below. |
| `OPERATOR_LEGAL_NAME` | Legal | The footer shows a preview notice until this is set. |
| `OPERATOR_CONTACT_EMAIL`, `SUPPORT_EMAIL`, `PRIVACY_EMAIL` | Legal | Default to `kaelisquinn@gmail.com`. |
| `DATABASE_SSL=1` | Optional | Only if the database needs SSL and the URL has no `sslmode`. |
| `DISCORD_REDIRECT_URI` | Optional | Defaults to `STORE_ORIGIN` + `/api/auth/discord/callback`. |

The public site shows no street address or country. Paddle gets the seller details it needs privately in its dashboard.

## Discord OAuth

Use the bot's Discord application. Add the redirect URI `https://disgrowth.net/api/auth/discord/callback`. The store requests `identify email` (the email pre-fills Paddle checkout) and never uses the bot token.

## Paddle

### Live catalog

These already exist. Do not recreate or delete them. One-time USD prices, quantity 1, tax category `standard`.

| SKU | Product | Price | Product id | Price id |
| --- | --- | --- | --- | --- |
| `gold-10` | Gold Bars — 500 | $10 | `pro_01m1vqmtxas0j2v1z35h8cyzck` | `pri_01m1vqmtydg3hrzxhsecae8d9v` |
| `gold-25` | Gold Bars — 1,275 | $25 | `pro_01m1vqmv1k673vgryex01ejzq9` | `pri_01m1vqmv2z51ehpf7f1bcd01jf` |
| `gold-50` | Gold Bars — 2,600 | $50 | `pro_01m1vqmv66et2m6xzd9vgvs1cv` | `pri_01m1vqmv7e7v51nja2mdcr7bgt` |
| `gold-100` | Gold Bars — 5,250 | $100 | `pro_01m1vqmvatcaehan5daxcym8pc` | `pri_01m1vqmvby50aw445v47wn7k16` |

### Dashboard settings

Do not delete the catalog, the checkout domain, the client-side token, or the webhook destination.

1. Update the existing notification destination to `https://disgrowth.net/api/webhooks/paddle`. Do not create a second one.
2. Subscribe to `transaction.completed`, `customer.created`, `customer.updated`, and `adjustment.updated`. Do not subscribe to `transaction.updated`, which can double-grant. Subscription events are ignored if they arrive.
3. Under Checkout > Website approval, `disgrowth.net` must be approved. The overlay and payment links stay closed until it is.
4. Under Checkout > Checkout settings, set the default payment link to `https://disgrowth.net`. The overlay success URL is `/welcome`.

### Pausing sales

Archive or unpublish the four prices. `/buy/:sku` still renders, and checkout fails closed if the API key or price ids are cleared.

### Rotating the webhook secret

Rotate it on the notification destination, update `PADDLE_WEBHOOK_SECRET` on the host, then restart. Signatures fail until both sides match.

## Database

`npm run migrate` applies every `sql/*.sql` file in order to `DATABASE_URL`. The VPS update unit runs it after each fast-forward. It never creates `players`; the bot owns that table. Order rows use `provider = 'paddle'`, and the `lemon_*` columns hold Paddle transaction and price ids for compatibility with the existing table.

### First-purchase Bonds

`store_first_purchase` records a Discord id after its first successful Gold Bar grant, which adds the listed Gold Bars plus the same number of Bonds. Later grants add Gold Bars only. Refunding that first grant deletes the row, claws back those Bonds (floor zero), and lets the gift apply again. To reset it by hand:

```sql
DELETE FROM store_first_purchase WHERE discord_id = :snowflake;
```

### Inspecting grants

```sql
SELECT processed_at, event_name, sku_key, discord_id, effect, gold_delta, lemon_order_id
FROM store_orders
ORDER BY id DESC
LIMIT 50;

SELECT discord_id, credits, bonds, gold_bars, subscription_active, subscription_expires_at
FROM players
WHERE discord_id = :snowflake;
```

An order with `effect = 'error_no_player'` means someone paid without a game character. Ask them to run `/disgrowth`, then resend the event from the Paddle dashboard. Never insert a `players` row from the store; the starting Credits grant would be skipped.

## Health

`GET /healthz` returns `{ "ok": true, "db": "up" | "down", "oauth": bool, "checkout": bool, "missing": [] }` without secrets.

- `db: "down"`: Postgres is down or `DATABASE_URL` is wrong.
- `checkout: false`: a Paddle variable is missing or invalid. `missing` lists what failed validation. Fix the env and restart the unit.

## HTTPS and nginx

`deploy/nginx/disgrowth.conf` is the origin config, using Cloudflare origin certificates at `/etc/ssl/cloudflare/disgrowth.pem` and `.key`.

- Port 80 proxies to Node while Cloudflare SSL is Flexible or the DNS record is grey-cloud. A redirect to HTTPS would loop in that state. Switch port 80 to `return 301 https://disgrowth.net$request_uri;` only after SSL is Full (strict) and the record is orange-cloud.
- nginx applies `CF-Connecting-IP` only when the TCP peer is in Cloudflare's published ranges. Node rate-limits by `req.ip` (one trusted hop) and ignores a client-supplied `CF-Connecting-IP`.
- Once orange-cloud is on, firewall origin ports 80 and 443 to Cloudflare IPs.

The header ticker and market pages read from in-process caches (30s and 15s), so visitors never query `price_history` directly.

## Logs

The app writes JSON lines to stdout and stderr, captured by systemd for `disgrowth-store`. Security-relevant events: `oauth_callback_failed`, `paddle_webhook_rejected`, `paddle_checkout_failed`, `paddle_portal_failed`.

## Discord bot

Shop buttons in the bot must link to the store, never to a raw Paddle URL, which would carry no Discord id:

```
STORE_CHECKOUT_GOLD_10=https://disgrowth.net/buy/gold-10
STORE_CHECKOUT_GOLD_25=https://disgrowth.net/buy/gold-25
STORE_CHECKOUT_GOLD_50=https://disgrowth.net/buy/gold-50
STORE_CHECKOUT_GOLD_100=https://disgrowth.net/buy/gold-100
```

The bot must not grant Gold Bars from Paddle itself. This store is the only grant path.

## Policies to keep in sync

- There are no analytics. Update the Cookie and Privacy policies before adding any.
- Pages are English only. Add Bahasa Indonesia before marketing to Indonesian consumers.
- Keep 2FA on GitHub, Paddle, Cloudflare, the VPS, and npm.
