# Operator fill-in

Complete before launch. Until `OPERATOR_LEGAL_NAME` is set in the environment, the site shows a preview banner: legal copy is draft.

```
OPERATOR_LEGAL_NAME=
OPERATOR_TRADING_NAME=Disgrowth
OPERATOR_REGISTERED_ADDRESS=
OPERATOR_COUNTRY=
GOVERNING_LAW=
VENUE=
OPERATOR_CONTACT_EMAIL=
SUPPORT_EMAIL=
PRIVACY_EMAIL=
DISCORD_SUPPORT_INVITE=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
STORE_ORIGIN=
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_PRICE_GOLD_10=
PADDLE_PRICE_GOLD_25=
PADDLE_PRICE_GOLD_50=
PADDLE_PRICE_GOLD_100=
PADDLE_ENV=sandbox
Lawyer review date=
Languages (EN only vs EN+ID)=
```

Also set every key in `.env.example` (session secret, database URL, Paddle API key, prices, and webhook secret).

After fill-in: remove nothing from git — the banner disappears automatically when `OPERATOR_LEGAL_NAME` is present.

## Before going public

You still have to do these outside this repo. The site will not grant Gold Bars until Paddle and Postgres are live.

1. **Legal entity.** Set `OPERATOR_LEGAL_NAME` (banner stays until you do). Fill address, country, venue. Have counsel review the Delaware / online-arbitration default in `GOVERNING_LAW` against the real company. Default emails are Gmail (`unifyralabs@gmail.com`); switch to a domain mailbox if you have one.
2. **Discord OAuth.** Same application as the bot. Redirect URI: `https://{{STORE_ORIGIN}}/api/auth/discord/callback`. Scope `identify` only.
3. **Database.** `DATABASE_URL` is the game Postgres. Run `npm run migrate`. Do not create stub `players` rows from the store.
4. **Paddle Billing (not Classic).** Sandbox first.
   - Four one-time prices: $10 / $25 / $50 / $100 → `pri_…` ids in env.
   - API key → `PADDLE_API_KEY`.
   - Notification destination `https://{{STORE_ORIGIN}}/api/webhooks/paddle`.
   - Events: `transaction.completed` and `adjustment.updated` only. Do **not** subscribe to `transaction.updated` (double-grant risk).
   - Default payment-link success URL → `/success` (the site also sends this on each transaction).
   - Go live: `PADDLE_ENV=production` plus live key and live price ids.
5. **Bot shop buttons** must open `{{STORE_ORIGIN}}/buy/gold-*`, never a raw Paddle URL (no Discord id on the payment).
6. **Languages.** Pages are English only. Add Bahasa Indonesia if you market to ID consumers.
7. **No analytics** in v1. If you add any, update Cookies + Privacy first.
