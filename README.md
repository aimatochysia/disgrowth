# MARKET GAME — STORE (Disgrowth)

Public website for the Disgrowth Discord economy game: Discord login, Lemon Squeezy checkout, grants written to the **same Postgres** the bot uses.

This repository is the store, not the game client. The Discord bot lives in the sibling `aimatochysia/market-game` repo. The specification below was copied from that bot so this site can be built without opening the bot tree.

## Run

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

- Node.js 20+ (JavaScript, not TypeScript)
- `GET /healthz` — process + database ping
- `npm run migrate` — creates `store_orders` on the game database
- Pages: `/` landing, `/store` shop, `/legal` policies, `/account`, `/buy/:sku`
- Drop illustrated plates into `public/art/` (see that folder’s README) when you have them

Operator fill-in: `OPERATOR.md`. Incident notes: `RUNBOOK.md`.

---

# Disgrowth web store — full requirements (self-contained)

---

## 0. How to use this file


1. Fill **§19 Operator fill-in checklist** before launch (legal entity, emails, jurisdiction, Discord application secret, Lemon Squeezy store).
2. Implement **§16 Implementation tasks** in order.
3. Point the Discord bot `/shop` Link buttons at this site’s `/buy/...` URLs (bot change is **not** this repo).

**Success looks like:** a player logs in with Discord, sees their wallets, buys Gold Bars or the Accountant pass on Lemon Squeezy, and the grant lands on the same `players` row the Discord bot uses — without selling Credits, without checkout before login, and with legal pages that actually match what the store does.

---

## 1. What you are building

A **small public website** that is the **only real-money store** for a Discord tycoon game.

| Name | Use |
| --- | --- |
| **Market Game** | Internal / legal / repo name of the game (dont use. use disgrowth for naming, but the repo is called market-game)|
| **Disgrowth** | Player-facing game name (Discord slash command `/disgrowth`) |
| **MARKET GAME — STORE** | Site header / tab title voice |

The game itself is a **Discord bot**. Players run shops, a city market, companies, and (when unlocked) a franchise network **inside Discord**, on canvas cards. The website is **not** a game client. It does not simulate days, shops, or trades. It sells two real-money things and shows account balances.

**Play:** Discord bot, slash commands, canvas GUI.  
**Pay:** this website → Lemon Squeezy checkout → webhook writes wallets on the **shared game Postgres**.

### 1.1 One-paragraph product (paste on the landing page)

> Disgrowth is a Discord economy game. You rent a room, open a shop, and grow a company on a shared city market — in Discord, not in a browser. Credits (CR) are earned in play and cannot be bought. Bonds (BN) are a daily spend wallet. Gold Bars (GL) are the premium wallet you can buy here. Convert Gold Bars into Bonds in Discord with `/shop` (1 GL = 1 BN, never the other way, never into Credits). The Accountant pass is a real-money subscription: extra daily Bonds and DM hints. Login with Discord before you pay so the purchase lands on your character.

### 1.2 What the Discord game actually is (context the website team will not have)

- **Runtime of the game (not this site):** Node.js CommonJS, discord.js v14, `@napi-rs/canvas`, PostgreSQL (Knex migrations), Redis. The store does not need Redis.
- **Time:** 1 real hour = 1 in-game day; 30 in-game days per in-game month; calendar is UTC epoch (`2026-01-01T00:00:00.000Z`). Irrelevant to checkout except: daily Bonds are granted by the **bot**, not the website.
- **Identity:** one character per Discord user. Database key is `players.discord_id` — a Discord snowflake string, unique. There is no email login, no password, no username/password account on the game.
- **Onboarding:** `/disgrowth` in Discord. Website checkout **should require an existing `players` row** (they have at least opened the bot once). If they have never touched the bot, tell them to run `/disgrowth` first. Do **not** insert a half-created player (see §7.3 — missing starting Credits bug).
- **GUI theme** the Discord cards already use (match the store): background `#0d1117`, panel `#161b22`, border `#30363d`, text `#e6edf3`, muted `#8b949e`, positive `#3fb950`, negative `#f85149`, accent `#58a6ff`. Shop gold `#d29922`. Cards are 800×450. Voice is dry, short, no slang, no meme, no “ uwu ”. Header style in Discord: `MARKET GAME — DASHBOARD` / `MARKET GAME — SHOP`. The store header is `MARKET GAME — STORE`.

### 1.3 Out of scope for the website (do not build)

- Playing the game in the browser (no shops, ticks, charts, gacha, bank, franchise desk).
- Selling **Credits (CR)**, extra ops companies, extra branches, ticket share, tax stamps, offline-cap extensions, equity, board seats.
- Converting GL → BN (that is a Discord `/shop` modal).
- Spending BN on franchise boosts (Discord `/shop` only).
- Discord bot commands, canvases, or day ticks.
- Gacha / recruit (currently **off** in the game). If it returns, loot-box disclosure is a **legal** follow-up, not a v1 SKU.
- Admin CMS beyond env-configured catalog.
- Native mobile apps.

---

## 2. Locked economy (do not reopen)

Older bot docs that mention Marks packs, Discord SKUs, recruit chits, or selling cosmetics as the live store are **stale**. Live lock:

### 2.1 Three wallets

| Wallet | Abbr | Column | Role | Real money? |
| --- | --- | --- | --- | --- |
| Credits | **CR** | `players.credits` | City economy: rent, COGS, tax, wages, filings | **Never sold. Never granted by this store.** |
| Bonds | **BN** | `players.bonds` | Free/pass daily spend; franchise convenience SKUs in Discord | **Not sold.** Pass increases the *daily grant* the bot pays. |
| Gold Bars | **GL** | `players.gold_bars` | Premium, bought here | **Yes — one-time packs on this site.** |

**Rename in progress:** `players.marks` is a **dual-write mirror** of `gold_bars`. Every GL grant **must** set both:

```sql
UPDATE players
SET gold_bars = gold_bars + :n,
    marks = marks + :n
WHERE discord_id = :discord_id;
```

(Use the exact SQL in §7.5 so Marks-only bot paths still see the balance.)

**Conversion (Discord only, document on the store):** GL → BN at **1:1**. Never BN → GL. Never either into CR.

**Daily Bonds (bot, not website):** 5 BN per in-game day if `subscription_active` is false; **12 BN** if the Accountant pass is on. Grant runs on the bot clock (`last_bonds_daily_at`), only for players whose `onboarding_step` is `complete` or `raise_stats`.

### 2.2 Discord `/shop` BN sinks (not sold on the website; list them so copy stays honest)

Prices are Bonds. Tuned ~20× so they are not casual snacks. Website copy may say “Gold Bars convert to Bonds in Discord, where franchise tools cost hundreds to thousands of BN.”

| SKU (Discord) | Cost | Effect |
| --- | --- | --- |
| Applicant blitz | 1000 BN | `franchise_blitz_months += 2` |
| Network rescue | 1600 BN | +12 health on franchise buckets |
| CEO sharpness | 600 BN | `franchise_sharpness_months += 2` |
| Instant month | 400 BN | run franchise month resolver now |
| Extra invest slot | 800 BN | `franchise_invest_slots += 1` |

### 2.3 Real-money SKUs (this website only)

| `sku_key` | Player label | Type | Grant | USD (placeholder) |
| --- | --- | --- | --- | --- |
| `gold-starter` | Gold Bars — starter | One-time | **500 GL** | **$9.99** |
| `gold-pack` | Gold Bars — pack | One-time | **1,600 GL** | **$24.99** |
| `accountant-pass` | Accountant pass | Subscription, calendar month | Set `subscription_active` / `subscription_expires_at` | **$6.99 / month** |

These USD amounts and GL counts are **placeholders for launch**. Label them `placeholder` in code comments. Do not bikeshed during implementation. Operator may retune in Lemon Squeezy and env before going live.

**Why these numbers:** the floor is not a $0.99 impulse pack. Starter covers Instant month (400 BN after convert) or most of Sharpness; it does **not** buy a 1000 BN blitz. Pack covers one rescue (1600) or one blitz + leftover. Pass is hints + 12 BN/day, **not** a Gold Bars dump and **not** purchasable with BN.

**Never sell:** CR packs, extra companies, extra branches, tax cuts, offline cap, equity, board seats, “win the sector” buffs.

### 2.4 Accountant pass (what the bot already does with the flags you will set)

The website does **not** implement hints. It only maintains:

- `players.subscription_active` (boolean)
- `players.subscription_expires_at` (timestamptz, nullable)

Bot behavior the store’s marketing must not overclaim:

- DM-only hints, ~95% accuracy, trend-based, not every trigger, minimum ~20 real hours between hint batches.
- Pauses if the player has no **guild** (server) interaction for **3 real days** (`last_seen_guild_at`). Logging into this website does **not** count as guild activity.
- Pass daily Bonds: 12 vs free 5 (bot grant).
- Full TXT financial-statement pack in Discord is a **separate** gated feature (`entity.financialStatementEnabled`, currently **false**). Do not advertise “full accountant reports” on the store.

Bot treats pass as active when `subscription_active` is true **and** (`subscription_expires_at` is null **or** `subscription_expires_at > now`). Prefer always setting an expiry from Lemon Squeezy `renews_at` / `ends_at` so a stuck `true` cannot last forever.

### 2.5 Feature flags in the live game (do not contradict on the site)

```
entity.corporateCreditEnabled: false
entity.financialStatementEnabled: false
entity.franchiseEnabled: true
gacha.recruitEnabled: false
gacha.placeholderManagers: true
```

Do not sell gacha pulls. Do not promise named recruit banners.

---

## 3. Recommended tech stack (website repo)

Not sacred; swap if you have a strong reason. Defaults chosen so Lemon Squeezy’s Next.js webhook recipe works and the raw body is available for HMAC.

| Layer | Choice |
| --- | --- |
| Framework | **Next.js** (App Router), Node.js runtime (not Edge for the webhook route) |
| Language | TypeScript |
| DB | **The game’s PostgreSQL** via `pg` (or Drizzle/Kysely). Same `DATABASE_URL` as the bot. Website v1 does **not** own a second source of truth. |
| Session | Encrypted httpOnly cookie (`iron-session` or similar). Store `discord_id`, `username`, `avatar`. |
| Auth | Discord OAuth2, scope **`identify` only**. No email scope in v1. |
| Payments | **Lemon Squeezy** hosted checkout (Merchant of Record). Optional Lemon.js overlay later. |
| Hosting | Any HTTPS host with Node (Fly, Railway, Vercel **if** webhook uses Node runtime + raw body). |
| CSS | Small custom CSS using tokens in §10. No Discord-blurple theme. No Tailwind-default purple SaaS look. |

**Architecture v1 (locked):** website **reads/writes the game database directly**. It owns table `store_orders` (create via its own migration **on the game DB** or a SQL file the operator runs once). It applies GL and pass grants itself.

**Architecture v2 (do not build until needed):** website calls a bot HMAC grant API. Only if you cannot share Postgres.

### 3.1 Sequence (happy path)

```
Player clicks /shop "Gold Bars — starter" in Discord
  → https://{{STORE_ORIGIN}}/buy/gold-starter
  → if no session: Discord OAuth (identify), return to /buy/gold-starter
  → load players WHERE discord_id = session
  → if no row: "Run /disgrowth in Discord first"
  → age + ToS checkboxes
  → redirect to Lemon Squeezy checkout URL with
        checkout[custom][discord_id]={{snowflake}}
        checkout[custom][sku_key]=gold-starter
  → player pays on Lemon Squeezy
  → LS POST {{STORE_ORIGIN}}/api/webhooks/lemonsqueezy
  → verify HMAC, idempotent insert store_orders, UPDATE players gold_bars+marks
  → player returns to /success
  → Discord /shop and /dashboard show new GL
```

Login **before** checkout is mandatory. Never put a raw Lemon Squeezy URL in Discord without `custom[discord_id]` — the webhook would not know whom to credit.

---

## 4. Discord OAuth2

Use the **same Discord Application** as the game bot when possible (`DISCORD_CLIENT_ID` matches the bot). The website needs **`DISCORD_CLIENT_SECRET`** (the bot today only uses the bot token + client id; the secret is new).

### 4.1 Developer Portal settings

1. Discord Developer Portal → the Market Game application → OAuth2.
2. Add redirect: `https://{{STORE_ORIGIN}}/api/auth/discord/callback` (and `http://localhost:3000/api/auth/discord/callback` for dev).
3. Scopes: `identify` only.
4. Bot stays as-is; this site never uses `DISCORD_TOKEN`.

### 4.2 Authorization URL

```
https://discord.com/oauth2/authorize
  ?client_id={{DISCORD_CLIENT_ID}}
  &redirect_uri={{urlencoded callback}}
  &response_type=code
  &scope=identify
  &state={{csrf_nonce}}
  &prompt=consent
```

- Generate `state`, store in a short-lived cookie, reject mismatch.
- Exchange `code` at `POST https://discord.com/api/oauth2/token` (client_id, client_secret, grant_type=authorization_code, code, redirect_uri).
- `GET https://discord.com/api/users/@me` with the access token.
- Persist session: `id` (snowflake string), `username`, `global_name`, `avatar`.
- **Do not store the Discord access token** longer than the request unless you need to refresh (you do not; identify is one-shot).
- Logout: clear cookie, `POST /logout`.

Discord user object `id` **is** `players.discord_id`. Compare as strings (snowflakes are > Number.MAX_SAFE_INTEGER).

### 4.3 Avatar URL (account page)

```
https://cdn.discordapp.com/avatars/{{id}}/{{avatar}}.png?size=64
```

If `avatar` is null, use Discord’s default embed avatar by discriminator/id modulo.

---

## 5. Lemon Squeezy setup (operator dashboard)

Lemon Squeezy is **Merchant of Record**: they collect payment, charge sales tax/VAT where they must, invoice the buyer, and pay the operator. The operator does **not** handle card data (PCI). Buyers also accept Lemon Squeezy’s checkout terms. The operator still publishes **game** Terms / Privacy / Refunds / Virtual Items (this site).

### 5.1 Store

1. Create a Lemon Squeezy store (test mode first).
2. Confirm the operator can be a seller from their country (payouts, identity, tax forms). If LS cannot onboard the entity, **stop** and change MoR — do not fake it.
3. Store name: `Market Game` or `Disgrowth`.
4. Support email: `{{SUPPORT_EMAIL}}`.
5. Link store policies to this site’s `/legal/*` URLs.

### 5.2 Products / variants

Create **three** products (one variant each for v1):

| Product | LS type | Variant | Env var for variant id |
| --- | --- | --- | --- |
| Gold Bars — starter | Standard (one-time) | Default | `LEMONSQUEEZY_VARIANT_GOLD_STARTER` |
| Gold Bars — pack | Standard (one-time) | Default | `LEMONSQUEEZY_VARIANT_GOLD_PACK` |
| Accountant pass | Subscription, **monthly** | Default | `LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS` |

Share **checkout overlay / hosted** buy URLs as well (optional if you always build URLs from variant ids):

```
https://{{LS_STORE}}.lemonsqueezy.com/checkout/buy/{{VARIANT_ID}}
```

Product descriptions must say: virtual currency / subscription for a Discord game; not cash-out; not a security; login required on the Market Game store; Credits cannot be bought.

Enable Lemon Squeezy’s checkout confirmation that the buyer agrees to terms; point the URL at `https://{{STORE_ORIGIN}}/legal/terms`.

### 5.3 Custom data (required)

Append to every checkout URL the site generates (never a naked buy link from Discord):

```
?checkout[custom][discord_id]={{snowflake}}
&checkout[custom][sku_key]={{gold-starter|gold-pack|accountant-pass}}
```

Optional: `checkout[email]` only if you collect email (v1: **do not**; LS collects email itself for the receipt).

Webhook payloads expose this as `meta.custom_data.discord_id` and `meta.custom_data.sku_key` (values may be strings).

Docs: <https://docs.lemonsqueezy.com/help/checkout/passing-custom-data>

### 5.4 Webhook endpoint

Dashboard → Settings → Webhooks:

- URL: `https://{{STORE_ORIGIN}}/api/webhooks/lemonsqueezy`
- Signing secret → `LEMONSQUEEZY_WEBHOOK_SECRET`
- Events (subscribe **only** these):

| Event | Why |
| --- | --- |
| `order_created` | Grant GL for one-time SKUs. **Ignore** GL grant if the variant is the pass (subscription). |
| `order_refunded` | Reverse GL (clamp at 0) or deactivate pass if that order was the pass. |
| `subscription_created` | Turn pass on; set expiry. |
| `subscription_updated` | Sync status / `renews_at` / `ends_at`. |
| `subscription_cancelled` | Keep access until `ends_at` if LS still has a period left; then off. |
| `subscription_resumed` | Turn pass on again. |
| `subscription_expired` | `subscription_active = false`. |
| `subscription_paused` | Treat as inactive for game perks (`subscription_active = false`) unless you explicitly want pause-with-access — **v1: inactive**. |
| `subscription_unpaused` | Restore active + expiry. |
| `subscription_payment_success` | Refresh `subscription_expires_at` from `renews_at`. |
| `subscription_payment_failed` | Do not immediately revoke if `ends_at`/`renews_at` still in the future; mark store_orders; bot expiry handles it. |
| `subscription_payment_recovered` | Same as payment_success. |

Return **HTTP 200** quickly after signature verify + durable insert. LS retries ~3 times on non-200.

### 5.5 Signature verification (mandatory)

1. Read the **raw request body bytes/text** (do not `JSON.parse` first).
2. `X-Signature` header is hex HMAC-SHA256 of that raw body with `LEMONSQUEEZY_WEBHOOK_SECRET`.
3. Compare with `crypto.timingSafeEqual` on buffers of equal length.

Sketch (Node, Next.js Node runtime):

```ts
import crypto from 'node:crypto';

function verifyLemonSqueezySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const signature = Buffer.from(header, 'hex');
  const hmac = Buffer.from(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), 'hex');
  if (signature.length !== hmac.length) return false;
  return crypto.timingSafeEqual(hmac, signature);
}
```

Reject 400/401 on failure. Never process unverified bodies.

Official Next.js note: <https://docs.lemonsqueezy.com/guides/tutorials/webhooks-nextjs>

### 5.6 Idempotency

Lemon Squeezy can deliver the same event more than once. Uniqueness:

```
UNIQUE (provider, provider_event_id)
```

Use `meta.event_name` + `data.id` (and for payment events the invoice id) as `provider_event_id`, e.g. `order_created:12345`. If insert conflicts, return 200 and **do not** grant again.

Also unique-guard the **economic effect**:

- One-time GL: at most one successful grant per `lemon_squeezy_order_id` + sku.
- Pass: latest subscription status wins; do not add GL.

### 5.7 Test mode

Use LS test mode + test cards. Simulate subscription events from the LS dashboard. Keep `LEMONSQUEEZY_STORE_ID` and reject webhooks whose `store_id` does not match (prevents another LS store from crediting you). Optionally require `test_mode` to match `NODE_ENV`.

---

## 6. Pages and routes

All pages: dark theme, footer legal links, “Not the game — play in Discord”.

| Route | Auth | Purpose |
| --- | --- | --- |
| `/` | Public | Landing. What Disgrowth is, three wallets, CTA Login with Discord, catalog preview. |
| `/login` | Public | Button → Discord OAuth. Query `?next=` allowed only as relative path on this origin. |
| `/api/auth/discord/callback` | Public | OAuth callback. |
| `/logout` | Session | Clear cookie, redirect `/`. |
| `/store` | Public ok; buy requires login | Catalog of 3 SKUs, prices, “what you get”. |
| `/buy/:sku_key` | **Required** | Validates sku, session, player row, checkboxes, redirects to LS. `sku_key` ∈ `gold-starter`, `gold-pack`, `accountant-pass`. |
| `/account` | **Required** | Avatar, username, CR (read-only), BN (read-only), GL, pass on/off + expiry. Note convert in `/shop`. |
| `/success` | Session optional | “Payment sent. Gold Bars and the pass update after the webhook (usually seconds). Open Discord `/shop`.” |
| `/legal/terms` | Public | Terms of Service (§12.3). |
| `/legal/privacy` | Public | Privacy (§12.4). |
| `/legal/refunds` | Public | Refunds (§12.5). |
| `/legal/cookies` | Public | Cookies (§12.6). |
| `/legal/virtual-items` | Public | Virtual currency license (§12.7). |
| `/support` | Public | `{{SUPPORT_EMAIL}}`, Discord server invite `{{DISCORD_SUPPORT_INVITE}}`, “purchases need Discord login”. |
| `/healthz` | Public | `200 { "ok": true, "db": "up"|"down" }` — do not expose secrets. |
| `POST /api/webhooks/lemonsqueezy` | LS HMAC | Grants. No session. |
| `POST /api/auth/logout` | Session | If you prefer POST logout. |

**Footer (every page):** Terms · Privacy · Refunds · Cookies · Virtual items · Support. One line: `© {{YEAR}} {{OPERATOR_LEGAL_NAME}}. Game: Disgrowth. Payments: Lemon Squeezy (Merchant of Record).`

**Nav:** Store · Account · Login/Logout. No fake “Play” that is not a Discord deep link.

Discord deep link for “Open the bot”: `{{DISCORD_APPLICATION_DIRECTORY_OR_INVITE}}` (operator fills). If unknown, “Use `/disgrowth` in the Market Game Discord server.”

### 6.1 `/buy/:sku_key` rules

1. Unknown sku → 404.
2. No session → redirect `/login?next=/buy/{sku}`.
3. Session but no `players` row → 200 page: “Run `/disgrowth` in Discord, then refresh.” **Do not start checkout.**
4. Show summary: name, price, grant, virtual-items warning, age 18+, links to Terms + Refunds + Virtual items.
5. Require checkboxes: (a) I am 18 or the age of majority in my country, (b) I agree to Terms and Virtual Items policy, (c) I understand Gold Bars and the pass have no cash value and cannot be sold for money.
6. Only then 302 to Lemon Squeezy with custom data.
7. Never accept `discord_id` from query string as identity. Session only.

### 6.2 Copy constraints (player-facing)

- No slang, no meme, no “print money”, no “guaranteed rich”.
- Currency abbreviations **CR / BN / GL** after first spell-out on the page.
- Do not call Gold Bars “coins” or Bonds “gems”.
- Do not imply Credits can be bought.
- Do not call the pass “win the game” or “auto-profit”. Accurate: “DM hints (not always, not perfect) and 12 Bonds per in-game day instead of 5.”
- Error voice: short, what happened, what to do.

---

## 7. Data model (game Postgres)

The website **does not create** the `players` table. The bot already did. Website **creates** `store_orders` (and optionally `store_webhook_events`).

### 7.1 `players` columns the store may touch

| Column | Type | Website |
| --- | --- | --- |
| `id` | serial PK | Read |
| `discord_id` | string, unique | Read (join key). Never update. |
| `credits` | int | **Read only.** Never increment from the store. |
| `marks` | int | Dual-write with GL grants/refunds |
| `gold_bars` | int not null default 0 | Increment on GL purchase; decrement on refund clamp ≥ 0 |
| `bonds` | int not null default 0 | **Read only** |
| `subscription_active` | boolean not null default false | Write from subscription events |
| `subscription_expires_at` | timestamptz null | Write from `renews_at` / `ends_at` |
| `onboarding_step` | string not null default `not_started` | Read (display “finish tutorial” if not complete) |
| `created_at` / `last_seen_at` | timestamptz | Do not use website traffic to fake Discord `last_seen_at` |

**Do not write:** `last_seen_guild_at`, `last_bonds_daily_at`, franchise columns, gacha columns, UI prefs. Website login is not guild activity.

### 7.2 `store_orders` (create this)

```sql
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
  -- 'gold_grant' | 'gold_refund' | 'pass_on' | 'pass_off' | 'pass_sync' | 'ignored' | 'error_no_player'
  gold_delta            INTEGER NOT NULL DEFAULT 0,
  payload               JSONB NOT NULL,
  processed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS store_orders_discord_id_idx ON store_orders (discord_id);
CREATE INDEX IF NOT EXISTS store_orders_order_id_idx ON store_orders (lemon_order_id);
```

### 7.3 Do not create stub players (v1 lock)

Bot `findOrCreatePlayer`:

- Inserts `discord_id`, `credits: 0`, `marks: 0`, `onboarding_step: 'not_started'`, `gold_bars: 0`, `bonds: 0`.
- Then records a ledger transaction category `starting_grant` for **5000 Credits** (increments `credits`).

If the website inserts a row **without** that grant, the bot will find the row later and **never** pay starting Credits.

**v1:** if `SELECT id FROM players WHERE discord_id = $1` returns nothing → do not checkout, do not insert. Show `/disgrowth` instructions.

**v2 (only if product insists on buy-before-play):** duplicate the bot create **exactly**, including `starting_grant` 5000 into `transactions` and `players.credits`. Prefer not to.

### 7.4 Catalog map (code)

```ts
export const CATALOG = {
  'gold-starter': {
    sku_key: 'gold-starter',
    label: 'Gold Bars — starter',
    kind: 'one_time',
    gold: 500,
    usdPlaceholder: 9.99,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_STARTER',
  },
  'gold-pack': {
    sku_key: 'gold-pack',
    label: 'Gold Bars — pack',
    kind: 'one_time',
    gold: 1600,
    usdPlaceholder: 24.99,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_PACK',
  },
  'accountant-pass': {
    sku_key: 'accountant-pass',
    label: 'Accountant pass',
    kind: 'subscription',
    gold: 0,
    usdPlaceholder: 6.99,
    variantEnv: 'LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS',
  },
} as const;
```

Map inbound `variant_id` → `sku_key` using those env ids. If `meta.custom_data.sku_key` is present and matches the variant map, use it; if they disagree, **do not grant**, log, mark `effect = 'ignored'`, alert `{{SUPPORT_EMAIL}}`.

### 7.5 Grant SQL (authoritative)

Run in a **single transaction** after inserting `store_orders` (or: insert order first with unique constraint, then grant; if grant fails, do not 200 until retried — or use outbox). Safer pattern:

1. `BEGIN`
2. Insert `store_orders`. On unique violation → `ROLLBACK` / return 200 (already processed).
3. Lock the player row: `SELECT * FROM players WHERE discord_id = $1 FOR UPDATE`
4. If missing → set effect `error_no_player`, `COMMIT`, 200 (do not retry forever for ghosts; operator can fix). Also email/log.
5. Apply effect.
6. `COMMIT`

**Gold grant (`order_created` for starter/pack):**

```sql
UPDATE players
SET gold_bars = gold_bars + :delta,
    marks     = marks + :delta
WHERE id = :player_id;
```

`:delta` is 500 or 1600 from catalog, **not** from the webhook payload amount (ignore buyers editing HTML). If LS `variant_id` maps to catalog, trust catalog.

**Gold refund (`order_refunded` for starter/pack):**

```sql
UPDATE players
SET gold_bars = GREATEST(0, gold_bars - :delta),
    marks     = GREATEST(0, marks - :delta)
WHERE id = :player_id;
```

If they already converted GL → BN, the GL wallet may be lower than `:delta`. **Clamp at 0.** Do not confiscate Bonds. Legal copy must say refunds may be denied or partial after conversion/spend (see §12.5).

**Pass on** (`subscription_created`, `subscription_unpaused`, `subscription_resumed`, `subscription_payment_success`, `subscription_payment_recovered`, and `subscription_updated` when status is `active` or `on_trial`):

```sql
UPDATE players
SET subscription_active = TRUE,
    subscription_expires_at = :expires_at
WHERE id = :player_id;
```

`:expires_at` = `attributes.ends_at` if not null, else `attributes.renews_at`. If both null, set `NOW() + interval '35 days'` as a safety ceiling and log.

**Pass off** (`subscription_expired`, `subscription_paused`, or `subscription_updated` with status in `expired`, `unpaid` (v1), and `cancelled` **only when** `ends_at` is in the past or null):

```sql
UPDATE players
SET subscription_active = FALSE,
    subscription_expires_at = COALESCE(:ends_at, NOW())
WHERE id = :player_id;
```

For `cancelled` with `ends_at` in the future: keep `subscription_active = TRUE` and set `subscription_expires_at = ends_at` (paid through period).

**`order_created` for the pass variant:** `effect = 'ignored'` for gold; wait for `subscription_created` (or apply pass_on if custom data is complete — but **do not double-apply**; unique event ids differ so pass_on twice must be idempotent: setting the same flags is OK).

### 7.6 Subscription statuses (Lemon Squeezy)

Typical `attributes.status`: `on_trial`, `active`, `paused`, `past_due`, `unpaid`, `cancelled`, `expired`.

v1 mapping:

| LS status | `subscription_active` |
| --- | --- |
| `on_trial`, `active`, `past_due` | true (until expiry timestamp) |
| `paused`, `unpaid`, `expired` | false |
| `cancelled` | true until `ends_at`, then false |

---

## 8. Environment variables

```bash
# Site
NODE_ENV=production
STORE_ORIGIN=https://store.example.com
# Session cookie encryption (32+ bytes)
SESSION_SECRET=

# Discord OAuth (same application as the bot, client secret is new)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://store.example.com/api/auth/discord/callback

# Game database (same as bot DATABASE_URL)
DATABASE_URL=postgres://...

# Lemon Squeezy
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_VARIANT_GOLD_STARTER=
LEMONSQUEEZY_VARIANT_GOLD_PACK=
LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS=
# Used to build hosted checkout URLs:
LEMONSQUEEZY_CHECKOUT_BASE=https://YOUR-STORE.lemonsqueezy.com/checkout/buy

# Public / legal (also inlined into pages)
OPERATOR_LEGAL_NAME=
OPERATOR_TRADING_NAME=Market Game
OPERATOR_REGISTERED_ADDRESS=
OPERATOR_COUNTRY=
GOVERNING_LAW=
OPERATOR_CONTACT_EMAIL=
SUPPORT_EMAIL=
PRIVACY_EMAIL=
DISCORD_SUPPORT_INVITE=
# Optional: application directory / bot invite
DISCORD_BOT_PUBLIC_URL=
```

`.env.example` in the new repo must list every key with empty values and comments copied from this section.

Bot repo (later, not this website) should set Link buttons to:

```
LEMONSQUEEZY_CHECKOUT_STARTER={{STORE_ORIGIN}}/buy/gold-starter
LEMONSQUEEZY_CHECKOUT_PACK={{STORE_ORIGIN}}/buy/gold-pack
LEMONSQUEEZY_CHECKOUT_PASS={{STORE_ORIGIN}}/buy/accountant-pass
```

Those bot env names are historical; values must be **this website**, not raw LS URLs.

---

## 9. Security requirements

- HTTPS only in production. `Secure; HttpOnly; SameSite=Lax` session cookie. `__Host-` prefix if possible.
- OAuth `state` CSRF. Reject `next=` that is not a relative path (`/buy/...`).
- Webhook: raw body HMAC, store id check, idempotency, no session.
- Do not log full webhook payloads with card last-four in **public** logs; redact `user_email`, `card_last_four`.
- Rate-limit `/login` and OAuth callback (e.g. 20/min/IP).
- `/healthz` may check DB; do not return `DATABASE_URL`.
- Content-Security-Policy: default self; allow Discord CDN for avatars; allow Lemon Squeezy if using overlay (`*.lemonsqueezy.com`).
- No user-supplied HTML. Discord usernames escaped.
- Parameterized SQL only.
- Do not expose Discord client secret or webhook secret to the browser.
- Age gate is a checkbox, not proof of age — still required.
- If you add analytics later, update Cookie + Privacy first. v1: **no** third-party analytics (no Google Analytics, no Meta pixel). Lemon Squeezy’s own checkout page is their processor.

---

## 10. Design system

### 10.1 Tokens (CSS variables)

```css
:root {
  --bg: #0d1117;
  --panel: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --muted: #8b949e;
  --positive: #3fb950;
  --negative: #f85149;
  --accent: #58a6ff;
  --gold: #d29922;
  --radius: 8px;
  --font: "IBM Plex Sans", "Noto Sans", "Liberation Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", "Liberation Mono", ui-monospace, monospace;
  --max: 960px;
}
```

Do **not** use Liberation fonts as a web license assumption; IBM Plex is SIL-licensed and close in tone. Body text ~16px, muted labels 13px, tabular numbers for wallets.

### 10.2 Layout

- Full-viewport `--bg`, not white.
- Top bar: `MARKET GAME — STORE` (letter-spacing, small caps or tracked uppercase), right: Store, Account, Login.
- Main column max 960px.
- Panels: `--panel` fill, 1px `--border`, 8px radius, 16–24px padding.
- Primary buttons: `--accent` background, `#0d1117` text **or** accent outline on dark (pick one and stick). Gold buttons **only** for “Buy Gold Bars”.
- Pass CTA: accent, not gold.
- Disabled: muted, no extra opacity tricks.
- Mobile: stack nav, wallets in a column, tap targets ≥ 44px. Verify 390px and 1280px.
- Do not clone Discord’s blurple, Nitro gradients, or emoji soup.

### 10.3 Landing structure

1. Header
2. Hero: “Disgrowth is played in Discord. This is the store.” + Login
3. Three-wallet diagram (CR cannot buy / BN daily / GL here)
4. Two product cards (GL packs) + one pass card
5. “How checkout works” 4 steps: Discord login → confirm 18+ → Lemon Squeezy pays → wallets update in `/shop`
6. Footer legal

### 10.4 Account wallets

Show CR with note “Cannot be purchased”. BN “Daily, granted in Discord”. GL “Premium”. Pass badge on/off + expiry in UTC.

---

## 11. Suggested visual / UX details

- Favicon: simple gold bar / square, dark. Not a Discord logo (trademark).
- Title: `Store — Market Game`
- `/success` does not claim “you have 500 GL” until you re-read DB; say “usually a few seconds”. Offer Refresh.
- Empty player: illustration-free; one paragraph + Discord instructions.
- Loading: no skeleton carnival; muted “Loading”.
- 404: `MARKET GAME — STORE` + link home.

---

## 12. Legal requirements and draft copy

Replace every `{{LIKE_THIS}}`. Have counsel review. These drafts assume:

- Operator is a small studio selling **virtual items** for a Discord game.
- Lemon Squeezy, Inc. (or its relevant entity) is **Merchant of Record** for the payment.
- Players may be worldwide; Discord’s own age floor is 13+, but **paid** checkout on this store is **18+** (operator policy).
- No securities, no crypto-asset, no cash-out, no secondary market run by the operator.
- Gacha is **off**; if it returns, add loot-box odds disclosure before selling pulls.

**If the operator is in Indonesia:** also consider UU ITE, UU Perlindungan Data Pribadi (UU 27/2022), and consumer protection rules for digital goods; counsel must map these drafts to Bahasa Indonesia versions if you market to ID consumers. **If EU/UK users are served:** GDPR/UK GDPR lawful basis + Art. 27 representative if required. **If California:** CCPA/CPRA notice. Lemon Squeezy’s privacy policy covers **their** checkout data; yours covers Discord OAuth + game DB + this site.

### 12.1 Compliance checklist (product)

- [ ] 18+ checkbox before redirect to LS
- [ ] Terms + Virtual Items accepted before redirect
- [ ] Footer links on every page
- [ ] LS checkout terms URL points at `/legal/terms`
- [ ] No CR for sale
- [ ] No “investment / profit / ROI / interest on Gold Bars” language
- [ ] Refund policy matches actual webhook behavior (clamp GL, no BN clawback)
- [ ] Privacy lists Discord id, username, avatar, wallet balances, LS webhook fields you store (`store_orders.payload` — **minimize**: consider storing redacted payload)
- [ ] No analytics cookies in v1 → Cookie policy says session + LS third-party on checkout
- [ ] Support email monitored
- [ ] Process to delete account / Discord id association on request (coordinate with bot: you cannot “delete Discord user”; you can delete store session and, with bot ops, wipe or anonymize `players` — **define** in Privacy)
- [ ] Accessibility: contrast on `#8b949e` over `#0d1117` is OK; buttons have text not color-only
- [ ] Export control / sanctioned countries: follow Lemon Squeezy’s blocked territories; do not promise service where they cannot pay

### 12.2 Roles of contracts

| Document | Who / what |
| --- | --- |
| Lemon Squeezy Buyer Terms | Payment, tax invoice, MoR |
| This site Terms of Service | License to use the store + virtual items in the game |
| Virtual Items Policy | GL / BN / CR / pass are licenses, no cash-out |
| Privacy | Operator’s processing (Discord OAuth, DB, logs) |
| Refunds | When you reverse grants vs when you refuse |
| Cookies | Session cookie; LS cookies on their domain |

---

### 12.3 Draft — Terms of Service

> Last updated: {{DATE}}
>
> **Operator.** These Terms are between you and **{{OPERATOR_LEGAL_NAME}}** (“Operator”, “we”), {{OPERATOR_REGISTERED_ADDRESS}}. Contact: {{OPERATOR_CONTACT_EMAIL}}.
>
> **Game.** “Disgrowth” / “Market Game” is a Discord-based simulation game operated by the Operator. The game client is a Discord bot. This website (the “Store”) sells certain virtual items and a subscription. Payments are processed by Lemon Squeezy as Merchant of Record.
>
> **Agreement.** By creating a session (Discord login) or completing a purchase you agree to these Terms, the Virtual Items Policy, the Refund Policy, and the Privacy Policy. If you do not agree, do not log in or pay.
>
> **Eligibility.** You must be allowed to use Discord under Discord’s Terms. You must be **at least 18 years old** (or the age of majority in your place of residence, if higher) to purchase. The Store is not directed at children. We do not knowingly take payment from anyone under 18.
>
> **Account.** Your game identity is your Discord account. You must log in with Discord before checkout so we can attach the purchase to `discord_id`. You are responsible for your Discord account security. We may refuse or reverse a grant if the Discord id on the payment does not match a real player row.
>
> **Not Discord.** The Store and the game are not endorsed by Discord Inc. Discord is a trademark of Discord Inc.
>
> **Not Lemon Squeezy’s game.** Lemon Squeezy processes payment. Game rules, virtual items, and Discord delivery are the Operator’s.
>
> **License, not ownership.** Gold Bars, Bonds, Credits, the Accountant pass, and any other in-game value are **licensed virtual items** as described in the Virtual Items Policy. They have no cash value. You may not sell, swap, or escrow them for real money. We may change, reset, or remove items when we reasonably need to operate or shut down the game.
>
> **Credits.** Credits cannot be purchased on the Store and never will be under these Terms as of the last updated date.
>
> **Acceptable use.** Do not attack the Store, scrape with abusive rates, exploit webhooks, falsify Discord identity, launder payments, or use the game or Store for anything illegal. We may suspend Store access and ask the game operators to suspend the linked character.
>
> **Service availability.** The Store and the game may be unavailable. Purchases grant virtual items in the game database; they do not guarantee uptime, a particular economic outcome, or competitive rank.
>
> **Accountant pass.** The pass provides in-game convenience described on `/store` (extra daily Bonds issued by the game bot, and occasional DM hints). Hints are imperfect, not professional advice, not guaranteed, and may pause if you are inactive in the Discord server. The pass is billed as a subscription via Lemon Squeezy.
>
> **Changes.** We may change the Store catalog, prices (for future buys), or these Terms. Continued use after notice (site post and/or Discord) counts as acceptance of the new Terms for later purchases. Material changes to virtual-item licences will not silently convert Credits into a paid product.
>
> **Disclaimer.** THE STORE AND GAME ARE PROVIDED “AS IS”. TO THE MAXIMUM EXTENT PERMITTED BY LAW WE DISCLAIM IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS, AND NON-INFRINGEMENT. SIMULATION OUTCOMES ARE NOT FINANCIAL ADVICE.
>
> **Liability cap.** TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR’S TOTAL LIABILITY ARISING OUT OF THE STORE OR VIRTUAL ITEMS IN ANY TWELVE-MONTH PERIOD IS LIMITED TO THE AMOUNTS YOU PAID FOR THE SPECIFIC PURCHASE GIVING RISE TO THE CLAIM (OR USD $50 IF GREATER CONSUMER RIGHTS APPLY AND CANNOT BE WAIVED). SOME PLACES DO NOT ALLOW THESE LIMITS.
>
> **Indemnity.** If you break these Terms or law and that causes claims against us, you will cover reasonable resulting costs, to the extent permitted.
>
> **Governing law.** {{GOVERNING_LAW}}, excluding conflict-of-law rules. Courts of {{VENUE}} have exclusive jurisdiction, except that consumers may have non-waivable rights to sue where they live.
>
> **Contact.** {{OPERATOR_CONTACT_EMAIL}} / {{SUPPORT_EMAIL}}.
>
> **Entire agreement.** These Terms plus the policies linked in the footer are the agreement for the Store. Discord’s terms govern Discord. Lemon Squeezy’s terms govern payment processing.

---

### 12.4 Draft — Privacy Policy

> Last updated: {{DATE}}
>
> **Controller.** {{OPERATOR_LEGAL_NAME}}, {{OPERATOR_REGISTERED_ADDRESS}}. Privacy contact: {{PRIVACY_EMAIL}}.
>
> **What this policy covers.** This site (the Store) and how we connect purchases to the Disgrowth / Market Game Discord bot database. It does **not** replace Discord’s Privacy Policy or Lemon Squeezy’s Privacy Policy.
>
> **Data we collect**
>
> 1. **Discord profile (OAuth `identify`).** User id (snowflake), username, display name, avatar hash. We do **not** request email in v1.
> 2. **Session.** Encrypted cookie so we remember who is logged in.
> 3. **Game account fields we read.** Credits, Bonds, Gold Bars, Marks (legacy mirror), subscription flags, onboarding step — to show `/account` and to apply purchases.
> 4. **Payments (via Lemon Squeezy webhooks).** Event type, order/subscription/variant ids, custom `discord_id` / `sku_key`, status, renewal/end timestamps. Lemon Squeezy collects your payment card, billing address, and email as Merchant of Record. We do not see your full card number.
> 5. **Logs.** IP address, user agent, URL, time, error codes — security and debugging, retained {{LOG_RETENTION_DAYS:90}} days unless needed for fraud.
>
> **Why.** Operate the Store, authenticate you, deliver virtual items, prevent fraud, meet accounting/tax cooperation with the MoR, and respond to support.
>
> **Legal bases (GDPR-style, if applicable).** Contract (deliver the item you bought), legitimate interests (security, fraud), consent (cookie banner if we ever add non-essential cookies — v1 session is strictly necessary), legal obligation (if a regulator lawfully asks).
>
> **Sharing.** Lemon Squeezy (payment). Hosting/database providers processing on our instructions. Discord (you log in there). We do not sell personal information.
>
> **International transfers.** Hosting may be outside your country. {{TRANSFER_MECHANISM: e.g. SCCs / LS as MoR}}.
>
> **Retention.** Session: {{SESSION_DAYS:14}} days idle. `store_orders`: duration of the game plus {{ORDER_RETENTION_YEARS:7}} years for accounting. Game `players` row: until you ask for deletion **and** we can process it without breaking legal holds.
>
> **Your rights.** Depending on where you live: access, correction, deletion, restriction, portability, objection, withdrawal of consent, complaint to a supervisory authority. To use them: {{PRIVACY_EMAIL}}. We may need to verify Discord identity.
>
> **Children.** Store purchases are 18+. We do not knowingly collect payment data from children. If you believe we have, contact {{PRIVACY_EMAIL}}.
>
> **California.** We do not sell or share personal information as those words are used in CCPA/CPRA for cross-context advertising. v1 has no advertising pixels.
>
> **Security.** HTTPS, hashed webhook secrets, restricted database credentials. No method is 100% secure.
>
> **Changes.** We will update this page and the “last updated” date.

**Implementation note:** store redacted webhook JSON (strip email, card last four, IP if any) to match this policy. If you persist full LS payloads, you must list those fields here.

---

### 12.5 Draft — Refund Policy

> Last updated: {{DATE}}
>
> Payments are charged by **Lemon Squeezy** as Merchant of Record. Chargebacks go through them; contacting us first is faster.
>
> **Virtual items.** Gold Bars and the Accountant pass are digital, delivered to the linked Discord id when our webhook succeeds (usually seconds).
>
> **Gold Bars.** If you request a refund **before** Gold Bars are spent or converted to Bonds, we will try to reverse the Gold Bars (and Marks mirror) and approve a refund via Lemon Squeezy. If you already converted GL → BN or spent BN, we **cannot** reliably take Bonds back (other players and the city economy may already be affected). We may refuse or only refund unused GL. Wallet floors at zero — we will not put your account into negative Gold Bars.
>
> **Accountant pass.** Unused time in the current billing period may be refunded at our discretion; access is turned off when the refund is processed. If you used pass perks (hints, extra Bonds already granted), we may refuse.
>
> **Chargebacks.** If you chargeback after receiving items, we may disable Store access and game perks and dispute with the MoR.
>
> **EU/UK consumer cooling-off.** Many places let you withdraw from digital content **unless** you consented to immediate delivery and acknowledged that you lose the withdrawal right. Our checkout checkboxes include that acknowledgement. Where the law still forces a refund, we will comply and reverse what we can.
>
> **How to ask.** Email {{SUPPORT_EMAIL}} from a way we can match your Discord id, with the Lemon Squeezy order email / order id. We aim to answer in {{SLA_DAYS:5}} business days.
>
> **Lemon Squeezy.** Their buyer terms also apply to the payment contract.

---

### 12.6 Draft — Cookie Policy

> Last updated: {{DATE}}
>
> **Strictly necessary.** After Discord login we set an encrypted **session cookie** (httpOnly, Secure, SameSite=Lax) so we know you are you. This is required for the Store to work. It is not advertising.
>
> **OAuth.** Short-lived `state` cookie to prevent CSRF during Discord login.
>
> **Lemon Squeezy.** When you leave our site for checkout, Lemon Squeezy may set cookies on **their** domain. See their policy.
>
> **v1 analytics.** None.
>
> **How to control.** You can log out (clears session) or block cookies in your browser; the Store will not stay logged in.

If you later add Plausible/GA, you must add a banner and this section **before** shipping the script.

---

### 12.7 Draft — Virtual Items Policy

> Last updated: {{DATE}}
>
> **License.** Gold Bars (GL), Bonds (BN), Credits (CR), and the Accountant pass are **limited, revocable, non-exclusive, non-transferable licences** to use features of Disgrowth / Market Game. They are **not** money, e-money, deposits, securities, commodities, or crypto-assets. They cannot be redeemed with us for cash.
>
> **Credits (CR).** Earned and spent inside the simulation. **Not for sale** on the Store.
>
> **Bonds (BN).** Daily spend wallet, granted by the game. Gold Bars convert **to** Bonds in Discord at 1:1. Conversion is one-way.
>
> **Gold Bars (GL).** Premium wallet sold on the Store. Dual-recorded internally with a legacy “Marks” field. Buying GL does not buy Credits.
>
> **Accountant pass.** Subscription licence for extra daily Bonds and in-game DM hints, while active and while you meet the game’s activity rules (including inactivity pause).
>
> **No secondary market.** You may not sell accounts, Gold Bars, or the pass for real money. We may reclaim items obtained that way.
>
> **Changes and shutdown.** We may rebalance numbers, close the game, or wipe wallets. If we shut down for good we are not required to cash out. We may offer goodwill at our discretion.
>
> **Bugs and exploits.** Items from bugs may be removed.
>
> **Taxes.** You are responsible for taxes on your side except where Lemon Squeezy collects as MoR.

---

### 12.8 Extra legal notes (do not put all on the site; operators/counsel)

- **Securities.** Do not describe GL as an investment. No profit share, no equity, no “hold GL and earn”.
- **Gambling.** v1 sells fixed GL amounts and a convenience sub. No paid randomized loot. If gacha returns **and** is paid, many countries require odds disclosure (NL, UK loot-box treatments, some US states, etc.).
- **Discord Platform.** Follow Discord Developer Terms: no malware, no abusive data, OAuth scopes minimized (`identify` only).
- **Trademarks.** Don’t use Discord’s logo as your app icon. “Not affiliated with Discord” on Terms is enough; don’t fake official branding.
- **Tax/accounting.** MoR invoices help; still book LS payouts. {{OPERATOR_COUNTRY}} corporate tax is on the operator.
- **Age.** Discord 13+ vs paid 18+ means a 16-year-old may play free and must not pay on this Store.
- **Accessibility / consumer law** may require Bahasa Indonesia (or other) if you actively market there — counsel.
- **Insurance / crime.** Chargeback fraud: require Discord login + existing player row (already locked).

---

## 13. Support and operations

- `/support` lists email + Discord invite.
- On `error_no_player` after a paid webhook (should be rare if `/buy` checked): alert {{SUPPORT_EMAIL}}, include LS order id + discord_id; operator runs `/disgrowth` with that user or manually inserts using **full** bot create rules then re-sends webhook from LS dashboard.
- Document a runbook in the website repo `RUNBOOK.md`: rotate webhook secret, pause catalog by setting variants hidden in LS, SQL to inspect `store_orders`.
- Keep LS and Discord secrets in the host’s secret manager, not git.

---

## 14. Testing (website repo)

Automated:

- HMAC reject / accept fixtures (raw body + secret).
- Idempotent double `order_created`.
- Variant mapping disagreement → no grant.
- GL grant dual-writes `gold_bars` and `marks`.
- Refund clamp at 0.
- Pass status matrix (active / cancelled with future ends_at / expired).
- OAuth `state` mismatch.
- `/buy` without session redirects; without player row no LS redirect.

Manual:

- Discord login on a real application (dev).
- LS test-mode purchase of starter → DB GL += 500.
- Test-mode pass subscribe → flags true; cancel → active until end; expire → false.
- Mobile 390px landing + buy.
- Screen reader: checkboxes labelled.

You cannot use the Discord bot’s interaction harness from this repo. Prove grants with SQL against a copy of `players`.

---

## 15. Bot integration (for the other repo; do not implement here)

After this store is live, the Discord bot should:

1. Set `LEMONSQUEEZY_CHECKOUT_*` to `{{STORE_ORIGIN}}/buy/...` so Link buttons carry the user through login.
2. Keep GL display from `gold_bars` (Marks dual-write).
3. **Not** implement a second Lemon Squeezy webhook if the website already grants (avoid double credit).

If the website cannot share Postgres, add an HMAC grant API on the bot instead — that is a bot-repo leftover, not v1 store.

---

## 16. Implementation tasks

For agentic workers in the **new website repo**. Check boxes as you go.

### Task 0 — Operator placeholders file

- [ ] Create `OPERATOR.md` listing every `{{PLACEHOLDER}}` with empty values.
- [ ] Create `.env.example` from §8.

### Task 1 — Scaffold

- [ ] Next.js App Router, TypeScript, ESLint.
- [ ] CSS variables from §10.
- [ ] Layout with header `MARKET GAME — STORE` and legal footer.
- [ ] `GET /healthz`.

### Task 2 — Discord OAuth

- [ ] Login button, state cookie, callback, session cookie, logout.
- [ ] Tests for `next=` open-redirect rejection.

### Task 3 — Database

- [ ] `pg` pool from `DATABASE_URL`.
- [ ] Migration/SQL for `store_orders`.
- [ ] Read-only account query by `discord_id`.

### Task 4 — Pages

- [ ] `/` landing copy from §1.1 + wallet explanation.
- [ ] `/store` three cards with placeholder USD.
- [ ] `/account` wallets + pass.
- [ ] `/buy/:sku` gates.
- [ ] `/success`, `/support`.
- [ ] Legal routes with draft copy **and** a visible “Not legal advice; placeholders” banner until `OPERATOR.md` is filled, then remove the banner.

### Task 5 — Lemon Squeezy checkout URLs

- [ ] Build URL from variant id + `checkout[custom][discord_id]` + `sku_key`.
- [ ] 18+ / Terms checkboxes required.

### Task 6 — Webhook

- [ ] Raw body + HMAC.
- [ ] Store id check.
- [ ] Idempotent grants §7.5.
- [ ] Tests with fixtures.

### Task 7 — Hardening

- [ ] CSP, rate limit login, redact logs.
- [ ] Confirm no CR write paths exist (`rg "credits"` on the store repo should not `UPDATE ... credits`).

### Task 8 — Launch

- [ ] Fill operator legal fields; lawyer pass.
- [ ] LS live mode products.
- [ ] Point bot shop links at `/buy/...`.
- [ ] Buy starter on live with a tiny real card / LS live test, confirm Discord `/shop` GL.

---

## 17. Acceptance tests (human)

1. Logged-out `/buy/gold-starter` ends up at Discord OAuth then back.
2. User who never ran the bot cannot pay (blocked page).
3. User who ran `/disgrowth` can pay test-mode starter; SQL shows `gold_bars` and `marks` += 500; Discord `/shop` matches.
4. Double-delivery of the same webhook does not add 1000.
5. Pass subscribe → `/account` shows on; Discord shop “Accountant pass **on**”.
6. Refund starter in LS → GL decreases, not below 0.
7. Footer legal pages render and match grants (no “cash out”).
8. Mobile + desktop layout readable, gold only on GL CTA.

---

## 18. Explicit non-goals (repeat)

- Browser game.
- Selling CR.
- Website GL→BN convert.
- Gacha SKUs.
- Sharing Discord bot token with this host.
- Storing player passwords.
- Webhook handler on the bot **and** the site both granting (pick one; v1 = site).

---

## 19. Operator fill-in checklist

Copy and complete in the new repo (`OPERATOR.md`):

```
OPERATOR_LEGAL_NAME=
OPERATOR_TRADING_NAME=Market Game
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
LEMONSQUEEZY store slug / id=
Lawyer review date=
Languages (EN only vs EN+ID)=
```

Until this is filled, keep a site banner: “Store in preview — legal entity and policies are drafts.”

---

## 20. Catalog numbers recap (placeholders)

| sku_key | GL | USD | LS type |
| --- | --- | --- | --- |
| gold-starter | 500 | 9.99 | one-time |
| gold-pack | 1600 | 24.99 | one-time |
| accountant-pass | 0 | 6.99 / month | subscription |

Daily Bonds (bot): 5 free / 12 pass. Convert 1 GL = 1 BN in Discord only.

---

*End of self-contained website specification. Implement in a new repository. Do not require any other Market Game file.*
