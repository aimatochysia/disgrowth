# Disgrowth Store

Web store for Disgrowth, the city market game played in Discord. Live at [disgrowth.net](https://disgrowth.net).

Players log in with Discord, buy Gold Bar packs through Paddle, and each purchase is credited to their character in the game's Postgres database. The game itself runs as a Discord bot in a separate repository.

## Stack

- Node.js 24, ES modules, Express 5
- Server-rendered HTML from tagged template literals (`src/lib/html.js` escapes by default)
- PostgreSQL through `pg`, shared with the Discord bot
- Paddle Billing (overlay checkout and webhooks), Discord OAuth2

## Getting started

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:3000
npm test
```

Pages render without a database or Paddle keys. Checkout, login, and wallets turn on as the matching variables are set. See [RUNBOOK.md](RUNBOOK.md) for the full configuration reference.

| Script | Purpose |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Start with file watching |
| `npm test` | Run the test suite (`node --test`) |
| `npm run migrate` | Apply `sql/*.sql` to `DATABASE_URL` in order |

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing page |
| `/store` | Public | Gold Bar packs with localized Paddle prices |
| `/buy/:sku` | Discord login and an existing game character | Order summary, consent checkboxes, checkout |
| `/account` | Discord login | Wallet balances and the Paddle invoice portal |
| `/market` | Public | Read-only city market prices and charts |
| `/welcome` | Public | Post-payment confirmation (Paddle success URL) |
| `/legal` | Public | Terms, privacy, refunds, cookies, and virtual items |
| `/support` | Public | Contact details |
| `/healthz` | Public | Process, database, and configuration status |
| `POST /api/webhooks/paddle` | Paddle signature | Grants and refunds |

## How a purchase works

1. The player logs in with Discord (`identify email`). The session is an encrypted, httpOnly cookie.
2. `/buy/:sku` requires an existing `players` row. The store never creates players, because the bot pays starting Credits when it creates a character.
3. After the age and terms checkboxes, Paddle checkout opens as an overlay. Without JavaScript, the server creates the transaction and redirects to Paddle. Both paths attach `discord_id` and `sku_key` as custom data.
4. On `transaction.completed`, the webhook verifies the signature, records the event in `store_orders` (idempotent on the Paddle event id), and adds the catalog amount to `players.gold_bars`. The first purchase on a Discord account also adds the same number of Bonds. Patron turns on once lifetime Gold Bars bought reach 2,600.
5. On an approved refund or chargeback (`adjustment.updated`), the grant is reversed, clamped at zero.

The store never writes `players.credits`.

## Catalog

Gold amounts live in `src/catalog.js`. Prices live on the Paddle price ids.

| SKU | Gold Bars | Price |
| --- | --- | --- |
| `gold-10` | 500 | $10 |
| `gold-25` | 1,275 | $25 |
| `gold-50` | 2,600 | $50 |
| `gold-100` | 5,250 | $100 |

## Project layout

```
src/
  app.js          Routes, security headers, rate limits
  server.js       HTTP server and graceful shutdown
  config.js       Environment parsing and readiness checks
  catalog.js      Packs and Paddle price mapping
  checkout.js     Server-side Paddle transactions (no-JS fallback)
  webhook.js      Paddle webhook handler
  grants.js       Webhook interpretation and wallet SQL
  oauth.js        Discord OAuth
  session.js      Encrypted session and OAuth state cookies
  market.js       Market snapshot, OHLC, and caching
  ticker.js       Header price ticker
  legal.js        Policy text
  views/          Page templates
public/           CSS, client scripts, favicon
sql/              Migrations for store-owned tables
deploy/nginx/     Origin config for the VPS
tests/            node:test suites
```

## Scene art

The background scene ships as SVG silhouettes. To replace a layer with illustrated art, add any of these files to `public/art/`. They are detected at startup.

| File | Layer |
| --- | --- |
| `sky-day.webp`, `.jpg`, or `.png` | Day sky |
| `sky-night.webp`, `.jpg`, or `.png` | Night sky, same framing as the day sky |
| `far.webp` or `far.png` | Distant ridge and skyline, transparent |
| `mid.webp` or `mid.png` | Forest and exchange hall, transparent |
| `near.webp` or `near.png` | Foreground grove, transparent |

Keep one horizon line across `far`, `mid`, and `near` so the parallax lines up. Do not use Discord branding in the art.
