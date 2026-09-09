# Operator fill-in

Complete before launch. Until `OPERATOR_LEGAL_NAME` is set in the environment, the site shows a preview banner: legal copy is draft.

See `.env.example`. That file is the fill list. Keys not listed there already have code defaults (Discord invite, governing law, session length, and similar).

```
SESSION_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DATABASE_URL=
STORE_ORIGIN=https://YOUR-PROJECT.vercel.app
PADDLE_ENV=production
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_CLIENT_TOKEN=
PADDLE_PRICE_GOLD_10=pri_01m1vqmtydg3hrzxhsecae8d9v
PADDLE_PRICE_GOLD_25=pri_01m1vqmv2z51ehpf7f1bcd01jf
PADDLE_PRICE_GOLD_50=pri_01m1vqmv7e7v51nja2mdcr7bgt
PADDLE_PRICE_GOLD_100=pri_01m1vqmvby50aw445v47wn7k16
OPERATOR_LEGAL_NAME=Kaelis Quinn
OPERATOR_CONTACT_EMAIL=kaelisquinn@gmail.com
SUPPORT_EMAIL=kaelisquinn@gmail.com
PRIVACY_EMAIL=kaelisquinn@gmail.com
```

Never commit API keys. Never set an env value to `-`, `blank`, or other placeholders (treated as empty). `SESSION_SECRET` must be 32+ random characters. On the VPS, `DATABASE_URL` is the Docker Postgres bound to `127.0.0.1` — the same database the bot uses.

After fill-in: remove nothing from git — the banner disappears automatically when `OPERATOR_LEGAL_NAME` is present.

## Live Paddle catalog (already created)

Do not recreate these. One-time USD prices, quantity 1–1, tax category `standard`.

| sku | Product | Price | product_id | price_id (env) |
|---|---|---|---|---|
| gold-10 | Gold Bars — 500 | $10 | `pro_01m1vqmtxas0j2v1z35h8cyzck` | `pri_01m1vqmtydg3hrzxhsecae8d9v` |
| gold-25 | Gold Bars — 1,275 | $25 | `pro_01m1vqmv1k673vgryex01ejzq9` | `pri_01m1vqmv2z51ehpf7f1bcd01jf` |
| gold-50 | Gold Bars — 2,600 | $50 | `pro_01m1vqmv66et2m6xzd9vgvs1cv` | `pri_01m1vqmv7e7v51nja2mdcr7bgt` |
| gold-100 | Gold Bars — 5,250 | $100 | `pro_01m1vqmvatcaehan5daxcym8pc` | `pri_01m1vqmvby50aw445v47wn7k16` |

First Gold Bar purchase on a Discord account grants **double Gold Bars**. Patron is **not** sold as days on a pack. Lifetime Gold Bars bought (net of refunds) ≥ **2,600** unlocks Patron tier 1.

```sql
DELETE FROM store_first_purchase WHERE discord_id = :snowflake;
```

## Before going public

You still have to do these outside this repo. The site will not grant Gold Bars until Paddle, Discord, and Postgres are live.

1. **VPS env** (`/opt/disgrowth/store/.env`). Real values only — never `-`.
   - Required to boot: `SESSION_SECRET` (32+ chars), `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DATABASE_URL` (the game Postgres the bot uses; `127.0.0.1` is correct on this machine).
   - Required to sell: `STORE_ORIGIN=https://disgrowth.net`, `PADDLE_ENV=production`, live `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN` (`live_…`), the four `PADDLE_PRICE_GOLD_*` ids above.
   - Paddle Checkout > Website approval must include `disgrowth.net` (not only `disgrowth.vercel.app`). Overlay and payment links on this domain stay closed until that domain is **approved**.
   - Optional: `OPERATOR_LEGAL_NAME` (preview banner until set), `DATABASE_SSL=1` if the host needs SSL and the URL has no `sslmode=require`.
2. **Legal entity.** Set `OPERATOR_LEGAL_NAME` (banner stays until you do). Emails default to `kaelisquinn@gmail.com`. The public site does not show a street address or operator country; contact is email. Paddle still gets whatever seller details they require in their dashboard (private).
3. **Discord OAuth.** Same application as the bot. Redirect URI: `https://{{STORE_ORIGIN}}/api/auth/discord/callback`. Scopes `identify email` (email prefills Paddle Checkout).
4. **Database.** `DATABASE_URL` is the game Postgres. Run `npm run migrate` against that database (the VPS update unit does this after a fast-forward). Do not create stub `players` rows from the store.
5. **Paddle Billing (live catalog is done).** You still must:
   - Notification destination URL `https://{{STORE_ORIGIN}}/api/webhooks/paddle`.
   - Events: `transaction.completed`, `customer.created`, `customer.updated`, and `adjustment.updated`. Do **not** subscribe to `transaction.updated`. Subscription events can be delivered; the store ignores them.
   - Paste the destination `endpoint_secret_key` into `PADDLE_WEBHOOK_SECRET`.
   - In Checkout > Checkout settings, set the **default payment link** to the live store origin (an approved domain, not localhost).
   - Overlay success URL is `/welcome`.
6. **Bot shop buttons** must open `{{STORE_ORIGIN}}/buy/gold-*`, never a raw Paddle URL (no Discord id on the payment).
7. **Languages.** Pages are English only. Add Bahasa Indonesia if you market to ID consumers.
8. **No analytics** in v1. If you add any, update Cookies + Privacy first.
9. Optional later: enable the **digital-goods** tax category in Paddle if you want it; products currently use `standard`.
10. **2FA** on GitHub, Paddle, Cloudflare, the VPS, and npm (if you ever publish). The store is Discord OAuth only — there is no password to hash.
11. **Nginx.** Copy `deploy/nginx/disgrowth.conf`. Port 80 currently proxies (needed while Cloudflare is Flexible or grey-cloud). Turn on HTTP→HTTPS 301 only after Full (strict) **and** orange-cloud. Default Paddle payment link must be `https://disgrowth.net`.
