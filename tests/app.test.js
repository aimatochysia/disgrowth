import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createQuoteCache } from '../src/ticker.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

function config(over = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-session-secret-32-characters-min',
    STORE_ORIGIN: 'http://127.0.0.1',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'http://127.0.0.1/api/auth/discord/callback',
    PADDLE_API_KEY: 'pdl_apikey_test',
    PADDLE_WEBHOOK_SECRET: 'whsec',
    PADDLE_ENV: 'sandbox',
    PADDLE_CLIENT_TOKEN: 'test_store_client_token',
    PADDLE_PRICE_GOLD_10: 'pri_gold_10',
    PADDLE_PRICE_GOLD_25: 'pri_gold_25',
    PADDLE_PRICE_GOLD_50: 'pri_gold_50',
    PADDLE_PRICE_GOLD_100: 'pri_gold_100',
    ...over,
  });
}

function paddleSignature(raw, secret, now = Date.now()) {
  const ts = String(Math.floor(now / 1000));
  const h1 = createHmac('sha256', secret).update(ts).update(':').update(raw).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

const TEST_SESSION_TOKEN = 'a'.repeat(43);
const idHash = (token) => createHash('sha256').update(token).digest('hex');

function mockDb({ player = null, seen = new Set(), grants = [], pending = {} } = {}) {
  const statements = [];
  const sessions = new Map([
    [idHash(TEST_SESSION_TOKEN), { discord_id: '42', username: 'ash', global_name: 'Ash', avatar: null, email: '' }],
  ]);
  const pendingOrders = new Map(Object.entries(pending));
  const firstPurchase = new Map();
  const orders = [];
  return {
    statements,
    sessions,
    pendingOrders,
    async createSession(row) {
      sessions.set(row.idHash, {
        discord_id: row.discordId,
        username: row.username,
        global_name: row.globalName,
        avatar: row.avatar,
        email: row.email,
      });
    },
    async findSession(hash) {
      return sessions.get(hash) || null;
    },
    async deleteSession(hash) {
      sessions.delete(hash);
    },
    async deleteSessionsFor(discordId) {
      for (const [hash, row] of sessions) if (row.discord_id === discordId) sessions.delete(hash);
    },
    async createPendingOrder({ transactionId, discordId, skuKey }) {
      pendingOrders.set(transactionId, { discord_id: discordId, sku_key: skuKey });
    },
    async findPendingOrder(transactionId) {
      return pendingOrders.get(transactionId) || null;
    },
    async findPlayerByDiscordId(id) {
      if (player && String(player.discord_id) === String(id)) return player;
      return null;
    },
    async hasUsedFirstPurchase(id) {
      return firstPurchase.has(String(id));
    },
    async findCustomerByDiscordId() {
      return null;
    },
    async withTransaction(fn) {
      const client = {
        async query(text, params = []) {
          if (/INSERT INTO store_orders/.test(text)) {
            const eventId = params[0];
            if (seen.has(eventId)) {
              const err = new Error('duplicate');
              err.code = '23505';
              throw err;
            }
            seen.add(eventId);
            orders.push({
              provider_event_id: params[0],
              lemon_order_id: params[3],
              sku_key: params[6],
              discord_id: params[7],
              effect: params[8],
              gold_delta: params[9],
            });
          }
          statements.push({ text, params });
          if (/INSERT INTO store_first_purchase/.test(text)) {
            const discordId = String(params[0]);
            if (firstPurchase.has(discordId)) {
              return { rowCount: 0, rows: [] };
            }
            firstPurchase.set(discordId, params[1]);
            return { rowCount: 1, rows: [{ discord_id: discordId }] };
          }
          if (/SELECT 1 FROM store_first_purchase/.test(text)) {
            const discordId = String(params[0]);
            const eventId = String(params[1]);
            if (firstPurchase.get(discordId) === eventId) {
              return { rowCount: 1, rows: [{ ok: 1 }] };
            }
            return { rowCount: 0, rows: [] };
          }
          if (/DELETE FROM store_first_purchase/.test(text)) {
            const discordId = String(params[0]);
            if (firstPurchase.get(discordId) === params[1]) {
              firstPurchase.delete(discordId);
              return { rowCount: 1, rows: [] };
            }
            return { rowCount: 0, rows: [] };
          }
          if (/SET gold_delta = \$1/.test(text) && /provider_event_id = \$2/.test(text)) {
            const order = orders.find((row) => row.provider_event_id === params[1]);
            if (order) order.gold_delta = params[0];
          }
          if (/SET sku_key = \$1, discord_id = \$2, gold_delta = \$3/.test(text)) {
            const order = orders.find((row) => row.provider_event_id === params[3]);
            if (order) {
              order.sku_key = params[0];
              order.discord_id = params[1];
              order.gold_delta = params[2];
            }
          }
          if (/FOR UPDATE/.test(text)) {
            return { rows: player ? [player] : [] };
          }
          if (/effect = 'gold_grant'/.test(text)) {
            if (grants.length) return { rows: grants };
            const lemonOrderId = params[0];
            const row = [...orders].reverse().find(
              (item) => String(item.lemon_order_id) === String(lemonOrderId) && item.effect === 'gold_grant',
            );
            return { rows: row ? [row] : [] };
          }
          if (/SUM\(gold_delta\)/.test(text)) {
            const discordId = String(params[0]);
            const lifetime = orders
              .filter(
                (item) =>
                  String(item.discord_id) === discordId &&
                  (item.effect === 'gold_grant' || item.effect === 'gold_refund'),
              )
              .reduce((sum, item) => sum + Number(item.gold_delta || 0), 0);
            return { rows: [{ lifetime }], rowCount: 1 };
          }
          if (/INSERT INTO customers/.test(text) || /INSERT INTO purchases/.test(text)) {
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
      };
      return fn(client);
    },
  };
}

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

function sessionCookie() {
  return `mg_session=${TEST_SESSION_TOKEN}`;
}

function cookiesFrom(res) {
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

test('src/app.js default export is an Express app', async () => {
  const { default: vercelEntry } = await import('../src/app.js');
  assert.equal(typeof vercelEntry, 'function');
  assert.equal(typeof vercelEntry.listen, 'function');
  assert.equal(typeof vercelEntry.handle, 'function');
});

test('homepage still renders when Vercel DATABASE_URL is localhost', async () => {
  const cfg = loadConfig({
    NODE_ENV: 'production',
    VERCEL: '1',
    SESSION_SECRET: 'test-session-secret-32-characters-min',
    STORE_ORIGIN: 'https://disgrowth.vercel.app',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DATABASE_URL: 'postgresql://market_game:market_game@127.0.0.1:5432/market_game',
    PADDLE_API_KEY: 'blank',
    PADDLE_WEBHOOK_SECRET: 'blank',
    PADDLE_ENV: 'production',
    PADDLE_PRICE_GOLD_10: 'pri_gold_10',
    PADDLE_PRICE_GOLD_25: 'pri_gold_25',
    PADDLE_PRICE_GOLD_50: 'pri_gold_50',
    PADDLE_PRICE_GOLD_100: 'pri_gold_100',
  });
  const app = createApp({ config: cfg, db: null, art: {} });
  await withServer(app, async (base) => {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('strict-transport-security') || '', /max-age=15552000/);
    const html = await home.text();
    assert.match(html, /Disgrowth/);
    const store = await fetch(`${base}/store`);
    assert.equal(store.status, 200);
    assert.equal((await fetch(`${base}/healthz`)).status, 404);
  });
});

test('src/server.js listens on Vercel with a localhost DATABASE_URL', async () => {
  const port = 18765;
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: rootDir,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      VERCEL: '1',
      PORT: String(port),
      SESSION_SECRET: 'test-session-secret-32-characters-min',
      DISCORD_CLIENT_ID: 'client',
      DISCORD_CLIENT_SECRET: 'secret',
      DATABASE_URL: 'postgresql://market_game:market_game@127.0.0.1:5432/market_game',
      STORE_ORIGIN: 'https://disgrowth.vercel.app',
      PADDLE_API_KEY: 'blank',
      PADDLE_WEBHOOK_SECRET: 'blank',
      PADDLE_ENV: 'production',
      PADDLE_PRICE_GOLD_10: 'pri_gold_10',
      PADDLE_PRICE_GOLD_25: 'pri_gold_25',
      PADDLE_PRICE_GOLD_50: 'pri_gold_50',
      PADDLE_PRICE_GOLD_100: 'pri_gold_100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [];
  child.stdout.on('data', (buf) => output.push(String(buf)));
  child.stderr.on('data', (buf) => output.push(String(buf)));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`server did not start: ${output.join('')}`)), 5000);
      child.stdout.on('data', (buf) => {
        if (String(buf).includes('MARKET GAME')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`server exited ${code}: ${output.join('')}`));
      });
    });
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Disgrowth/);
  } finally {
    child.kill('SIGKILL');
    await new Promise((resolve) => child.once('exit', resolve));
  }
});

test('homepage ticker is a cached market strip, not a per-request query', async () => {
  const cfg = config();
  let loads = 0;
  const db = {
    ...mockDb(),
    async latestTickerQuotes() {
      loads += 1;
      return [{ ticker: 'PRDC', price: 39.2633, prev_price: 39.5986 }];
    },
  };
  const quoteCache = createQuoteCache({
    load: () => db.latestTickerQuotes(),
    interval: false,
  });
  await quoteCache.refresh();
  const app = createApp({ config: cfg, db, art: {}, quoteCache });
  await withServer(app, async (base) => {
    const home = await fetch(`${base}/`);
    const store = await fetch(`${base}/store`);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /class="ticker"/);
    assert.match(html, />PRDC</);
    assert.match(html, /39\.26/);
    assert.match(await store.text(), />PRDC</);
    assert.equal(loads, 1);
  });
  quoteCache.stop();
});

test('/buy without session redirects to login', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /\/login\?next=%2Fbuy%2Fgold-10/);
  });
});

test('/buy without player row does not redirect to Paddle', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb({ player: null }), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      redirect: 'manual',
      headers: { cookie: sessionCookie(cfg) },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /\/disgrowth/);
    assert.match(html, /discord\.gg\/XMadQ9tAd/);
    assert.doesNotMatch(html, /paddle\.com/);
  });
});

test('POST /buy without player does not 302 to Paddle', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb({ player: null }), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        cookie: sessionCookie(cfg),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'age=yes&terms=yes&novalue=yes',
    });
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('location'), null);
  });
});

test('POST /buy with player creates a Paddle transaction and redirects', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const calls = [];
  const db = mockDb({ player });
  const app = createApp({
    config: cfg,
    db,
    art: {},
    fetchImpl: async (url, opts) => {
      calls.push({ url: String(url), opts });
      return {
        ok: true,
        async json() {
          return { data: { id: 'txn_test', checkout: { url: 'https://sandbox-buy.paddle.com/checkout/txn_test' } } };
        },
        async text() {
          return '';
        },
      };
    },
  });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        cookie: sessionCookie(cfg),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'age=yes&terms=yes&novalue=yes',
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://sandbox-buy.paddle.com/checkout/txn_test');
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /sandbox-api\.paddle\.com\/transactions/);
    const sent = JSON.parse(calls[0].opts.body);
    assert.equal(sent.items[0].price_id, 'pri_gold_10');
    assert.equal(sent.custom_data, undefined);
    assert.deepEqual(db.pendingOrders.get('txn_test'), { discord_id: '42', sku_key: 'gold-10' });
    assert.equal(sent.checkout.url, 'http://127.0.0.1');
    assert.equal(sent.checkout.settings.success_url, 'http://127.0.0.1/welcome');
  });
});

test('POST /buy retries Paddle checkout without STORE_ORIGIN when the domain is not approved', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const calls = [];
  const app = createApp({
    config: cfg,
    db: mockDb({ player }),
    art: {},
    fetchImpl: async (url, opts) => {
      const sent = JSON.parse(opts.body);
      calls.push(sent);
      if (sent.checkout?.url) {
        return {
          ok: false,
          status: 400,
          async json() {
            return {};
          },
          async text() {
            return JSON.stringify({
              error: {
                detail: 'The value you passed for `checkout.url` does not contain a domain that has been approved by Paddle',
              },
            });
          },
        };
      }
      return {
        ok: true,
        async json() {
          return { data: { id: 'txn_test', checkout: { url: 'https://disgrowth.vercel.app?_ptxn=txn_fallback' } } };
        },
        async text() {
          return '';
        },
      };
    },
  });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        cookie: sessionCookie(cfg),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'age=yes&terms=yes&novalue=yes',
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://disgrowth.vercel.app?_ptxn=txn_fallback');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].checkout.url, 'http://127.0.0.1');
    assert.equal(calls[1].checkout.url, undefined);
  });
});

test('/buy with player shows first-purchase Bonds copy', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const app = createApp({ config: cfg, db: mockDb({ player }), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      headers: { cookie: sessionCookie(cfg) },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Gold Bars — 500/);
    assert.doesNotMatch(html, /500 Gold Bars/);
    assert.doesNotMatch(html, /1,000 Gold Bars|Gold Bars — 1,000/);
    assert.match(html, /First purchase/);
    assert.match(html, /\+500 Bonds/);
    assert.doesNotMatch(html, /double the listed Gold Bars/);
    assert.match(html, /\/legal#refunds/);
    assert.match(html, /data-paddle-overlay/);
    assert.match(html, /id="paddle-boot"/);
    assert.match(html, /Are you 18 or older/);
    assert.match(html, /data-age-yes/);
    assert.match(html, /data-age-no/);
  });
});

test('unknown sku is 404', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/marks-pack`, {
      headers: { cookie: sessionCookie(cfg) },
    });
    assert.equal(res.status, 404);
  });
});

test('oauth next= cannot leave this origin', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/auth/discord?next=https://evil.example/phish`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const loc = res.headers.get('location');
    assert.match(loc, /discord.com\/oauth2\/authorize/);
    assert.doesNotMatch(loc, /evil/);
    assert.doesNotMatch(loc, /prompt=consent/);
  });
});

test('logged-in /login redirects to shop instead of asking again', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const shop = await fetch(`${base}/login`, {
      redirect: 'manual',
      headers: { cookie: sessionCookie(cfg) },
    });
    assert.equal(shop.status, 302);
    assert.equal(shop.headers.get('location'), '/store');

    const buy = await fetch(`${base}/login?next=${encodeURIComponent('/buy/gold-10')}`, {
      redirect: 'manual',
      headers: { cookie: sessionCookie(cfg) },
    });
    assert.equal(buy.status, 302);
    assert.equal(buy.headers.get('location'), '/buy/gold-10');

    const loop = await fetch(`${base}/login?next=${encodeURIComponent('/login')}`, {
      redirect: 'manual',
      headers: { cookie: sessionCookie(cfg) },
    });
    assert.equal(loop.status, 302);
    assert.equal(loop.headers.get('location'), '/store');
  });
});

test('oauth callback signs in from Discord state and returns to next', async () => {
  const cfg = config();
  const app = createApp({
    config: cfg,
    db: mockDb(),
    art: {},
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes('/oauth2/token')) {
        return {
          ok: true,
          async json() {
            return { access_token: 'tok' };
          },
          async text() {
            return '';
          },
        };
      }
      if (href.includes('/users/@me')) {
        return {
          ok: true,
          async json() {
            return { id: '99', username: 'ash', global_name: 'Ash', avatar: null, email: 'a@b.c' };
          },
          async text() {
            return '';
          },
        };
      }
      throw new Error(`unexpected fetch ${href}`);
    },
  });
  await withServer(app, async (base) => {
    const start = await fetch(`${base}/auth/discord?next=${encodeURIComponent('/buy/gold-10')}`, {
      redirect: 'manual',
    });
    assert.equal(start.status, 302);
    const loc = new URL(start.headers.get('location'));
    const state = loc.searchParams.get('state');
    assert.ok(state);
    const cb = await fetch(
      `${base}/api/auth/discord/callback?code=ok&state=${encodeURIComponent(state)}`,
      { redirect: 'manual', headers: { cookie: cookiesFrom(start) } },
    );
    assert.equal(cb.status, 200);
    assert.match(cb.headers.get('set-cookie') || '', /mg_session=/);
    const html = await cb.text();
    assert.match(html, /\/buy\/gold-10/);
    assert.doesNotMatch(html, /\/login/);
  });
});

test('oauth state mismatch redirects to login', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/auth/discord/callback?code=abc&state=nope`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /\/login\?error=oauth/);
  });
});

test('HTML responses set clickjacking and MIME sniffing headers', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(String(res.headers.get('x-frame-options') || res.headers.get('content-security-policy')), /DENY|frame-ancestors 'none'/i);
    assert.match(res.headers.get('content-security-policy') || '', /cdn\.paddle\.com/);
  });
});

test('POST /buy with a foreign Origin is forbidden', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const app = createApp({
    config: cfg,
    db: mockDb({ player }),
    art: {},
    fetchImpl: async () => {
      throw new Error('paddle must not be called');
    },
  });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        cookie: sessionCookie(cfg),
        origin: 'https://evil.example',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'age=yes&terms=yes&novalue=yes',
    });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('location'), null);
  });
});

test('POST /buy does not redirect to an untrusted checkout URL', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const app = createApp({
    config: cfg,
    db: mockDb({ player }),
    art: {},
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { data: { id: 'txn_test', checkout: { url: 'https://evil.example/checkout' } } };
      },
      async text() {
        return '';
      },
    }),
  });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        cookie: sessionCookie(cfg),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'age=yes&terms=yes&novalue=yes',
    });
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('location'), null);
  });
});

test('oauth callback rejects a non-numeric Discord id', async () => {
  const cfg = config();
  const app = createApp({
    config: cfg,
    db: mockDb(),
    art: {},
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes('/oauth2/token')) {
        return { ok: true, async json() { return { access_token: 'tok' }; }, async text() { return ''; } };
      }
      return {
        ok: true,
        async json() {
          return { id: 'not-a-snowflake', username: 'x' };
        },
        async text() {
          return '';
        },
      };
    },
  });
  await withServer(app, async (base) => {
    const start = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
    const loc = new URL(start.headers.get('location'));
    const state = loc.searchParams.get('state');
    const cb = await fetch(
      `${base}/api/auth/discord/callback?code=ok&state=${encodeURIComponent(state)}`,
      { redirect: 'manual', headers: { cookie: cookiesFrom(start) } },
    );
    assert.equal(cb.status, 302);
    assert.match(cb.headers.get('location'), /\/login\?error=oauth/);
    assert.doesNotMatch(cb.headers.get('set-cookie') || '', /mg_session=/);
  });
});

test('webhook HMAC reject', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/webhooks/paddle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': 'ts=1;h1=00' },
      body: '{}',
    });
    assert.equal(res.status, 401);
  });
});

test('legacy Lemon Squeezy webhook path is gone', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/webhooks/lemonsqueezy`, { method: 'POST', body: '{}' });
    assert.equal(res.status, 404);
  });
});

test('idempotent double transaction.completed does not grant twice', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player, pending: { txn_5001: { discord_id: '42', sku_key: 'gold-10' } } });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    event_id: 'evt_5001',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_5001',
      items: [{ price: { id: 'pri_gold_10' } }],
    },
  });
  const sig = paddleSignature(raw, cfg.PADDLE_WEBHOOK_SECRET);

  await withServer(app, async (base) => {
    const post = () =>
      fetch(`${base}/api/webhooks/paddle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'paddle-signature': sig },
        body: raw,
      });
    const a = await post();
    const b = await post();
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const ba = await b.json();
    assert.equal(ba.duplicate, true);
    const grants = db.statements.filter((s) => /gold_bars = gold_bars \+/.test(s.text));
    assert.equal(grants.length, 1);
    assert.equal(grants[0].params[0], 500);
    const bonds = db.statements.filter((s) => /SET bonds = bonds \+/.test(s.text));
    assert.equal(bonds.length, 1);
    assert.equal(bonds[0].params[0], 500);
  });
});

test('second gold-10 purchase is catalog amount, not doubled', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({
    player,
    pending: {
      txn_first: { discord_id: '42', sku_key: 'gold-10' },
      txn_second: { discord_id: '42', sku_key: 'gold-10' },
    },
  });
  const app = createApp({ config: cfg, db, art: {} });

  await withServer(app, async (base) => {
    for (const [eventId, txnId] of [
      ['evt_first', 'txn_first'],
      ['evt_second', 'txn_second'],
    ]) {
      const raw = JSON.stringify({
        event_id: eventId,
        event_type: 'transaction.completed',
        data: {
          id: txnId,
          items: [{ price: { id: 'pri_gold_10' } }],
        },
      });
      const res = await fetch(`${base}/api/webhooks/paddle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'paddle-signature': paddleSignature(raw, cfg.PADDLE_WEBHOOK_SECRET) },
        body: raw,
      });
      assert.equal(res.status, 200);
    }
    const grants = db.statements.filter((s) => /gold_bars = gold_bars \+/.test(s.text));
    assert.equal(grants.length, 2);
    assert.equal(grants[0].params[0], 500);
    assert.equal(grants[1].params[0], 500);
    const bonds = db.statements.filter((s) => /SET bonds = bonds \+/.test(s.text));
    assert.equal(bonds.length, 1);
    assert.equal(bonds[0].params[0], 500);
  });
});

test('gold-25 transaction.completed does not stack Patron days', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player, pending: { txn_5002: { discord_id: '42', sku_key: 'gold-25' } } });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    event_id: 'evt_5002',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_5002',
      items: [{ price: { id: 'pri_gold_25' } }],
    },
  });
  const sig = paddleSignature(raw, cfg.PADDLE_WEBHOOK_SECRET);

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/webhooks/paddle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': sig },
      body: raw,
    });
    assert.equal(res.status, 200);
    const grants = db.statements.filter((s) => /gold_bars = gold_bars \+/.test(s.text));
    assert.equal(grants.length, 1);
    assert.equal(grants[0].params[0], 1275);
    const bonds = db.statements.filter((s) => /SET bonds = bonds \+/.test(s.text));
    assert.equal(bonds.length, 1);
    assert.equal(bonds[0].params[0], 1275);
    const stacked = db.statements.filter((s) => /INTERVAL '1 day'/.test(s.text));
    assert.equal(stacked.length, 0);
    const patron = db.statements.filter((s) => /subscription_active = \$1/.test(s.text) && /subscription_expires_at = NULL/.test(s.text));
    assert.equal(patron.length, 1);
    assert.equal(patron[0].params[0], false);
  });
});

test('gold-50 first purchase unlocks Patron tier 1 from lifetime Gold Bars', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player, pending: { txn_50: { discord_id: '42', sku_key: 'gold-50' } } });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    event_id: 'evt_50',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_50',
      customer_id: 'ctm_50',
      items: [{ price: { id: 'pri_gold_50', product_id: 'pro_50' } }],
      details: { totals: { grand_total: '5000', currency_code: 'USD' } },
    },
  });
  const sig = paddleSignature(raw, cfg.PADDLE_WEBHOOK_SECRET);

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/webhooks/paddle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': sig },
      body: raw,
    });
    assert.equal(res.status, 200);
    const grants = db.statements.filter((s) => /gold_bars = gold_bars \+/.test(s.text));
    assert.equal(grants[0].params[0], 2600);
    const bonds = db.statements.filter((s) => /SET bonds = bonds \+/.test(s.text));
    assert.equal(bonds.length, 1);
    assert.equal(bonds[0].params[0], 2600);
    const patron = db.statements.filter((s) => /subscription_active = \$1/.test(s.text) && /subscription_expires_at = NULL/.test(s.text));
    assert.equal(patron.length, 1);
    assert.equal(patron[0].params[0], true);
    assert.equal(patron[0].params[2], 2600);
  });
});

test('refund of a first purchase reverses listed gold and matching Bonds', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player, pending: { txn_bonus: { discord_id: '42', sku_key: 'gold-10' } } });
  const app = createApp({ config: cfg, db, art: {} });
  const paid = JSON.stringify({
    event_id: 'evt_bonus',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_bonus',
      items: [{ price: { id: 'pri_gold_10' } }],
    },
  });
  const refund = JSON.stringify({
    event_id: 'evt_refund',
    event_type: 'adjustment.updated',
    data: {
      id: 'adj_bonus',
      action: 'refund',
      status: 'approved',
      transaction_id: 'txn_bonus',
      custom_data: {},
      items: [],
    },
  });

  await withServer(app, async (base) => {
    const a = await fetch(`${base}/api/webhooks/paddle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': paddleSignature(paid, cfg.PADDLE_WEBHOOK_SECRET) },
      body: paid,
    });
    assert.equal(a.status, 200);
    const b = await fetch(`${base}/api/webhooks/paddle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': paddleSignature(refund, cfg.PADDLE_WEBHOOK_SECRET) },
      body: refund,
    });
    assert.equal(b.status, 200);
    const refunds = db.statements.filter((s) => /gold_bars = GREATEST/.test(s.text));
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].params[0], 500);
    const bondRefunds = db.statements.filter((s) => /bonds = GREATEST/.test(s.text));
    assert.equal(bondRefunds.length, 1);
    assert.equal(bondRefunds[0].params[0], 500);
    const resets = db.statements.filter((s) => /DELETE FROM store_first_purchase/.test(s.text));
    assert.equal(resets.length, 1);
  });
});

test('landing and legal pages render', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /Disgrowth/);
    assert.match(html, /celestial-axis/);
    assert.match(html, /Join the community/);
    assert.match(html, /discord\.gg\/XMadQ9tAd/);
    assert.match(html, />Home</);
    assert.match(html, />Shop</);
    assert.doesNotMatch(html, />Market</);
    assert.match(html, />Legal</);
    assert.match(html, />Terms</);
    assert.match(html, /btn-discord/);
    assert.doesNotMatch(html, /In the city/);
    assert.match(html, /Start here/);
    assert.doesNotMatch(html, /canopy|Rent a stall|dont store/);
    assert.match(html, /Paddle/);
    assert.match(html, /data-to-top/);
    assert.doesNotMatch(html, /Are you 18 or older/);
    assert.doesNotMatch(html, /Lemon Squeezy/);
    assert.doesNotMatch(html, /Three wallets/);
    assert.doesNotMatch(html, /On the shelf/);
    assert.doesNotMatch(html, /this site is only the real-money store/);
    assert.doesNotMatch(html, /nav-support/);
    const legal = await fetch(`${base}/legal/terms`, { redirect: 'manual' });
    assert.equal(legal.status, 302);
    assert.match(legal.headers.get('location'), /\/legal#terms/);
    const book = await fetch(`${base}/legal`);
    assert.equal(book.status, 200);
    const legalHtml = await book.text();
    assert.match(legalHtml, /Terms of Service/);
    assert.match(legalHtml, /Refund Policy/);
    assert.match(legalHtml, /two \(2\) hours/);
    assert.match(legalHtml, /as many Bonds as Gold Bars listed for that pack/);
    assert.match(legalHtml, /First Gold Bar purchase/);
    assert.doesNotMatch(legalHtml, /double the Gold Bars/);
    assert.doesNotMatch(legalHtml, /Unlocks Patron tier 1/);
    assert.match(legalHtml, /Paddle/);
    assert.match(legalHtml, /do not publish a street address/);
    assert.doesNotMatch(legalHtml, /Lemon Squeezy/);
    assert.doesNotMatch(legalHtml, /address not yet published/);
    assert.doesNotMatch(legalHtml, /Delaware/);
    const store = await fetch(`${base}/store`);
    const storeHtml = await store.text();
    assert.match(storeHtml, /Gold Bars — 500/);
    assert.match(storeHtml, /Gold Bars — 1,275/);
    assert.match(storeHtml, /Gold Bars — 2,600/);
    assert.match(storeHtml, /Gold Bars — 5,250/);
    assert.doesNotMatch(storeHtml, /(500|1,275|2,600|5,250) Gold Bars/);
    assert.doesNotMatch(storeHtml, /Delivered to your Discord character/);
    assert.match(storeHtml, /same number of Bonds as Gold Bars/);
    assert.doesNotMatch(storeHtml, /Unlocks Patron tier 1/);
    assert.doesNotMatch(storeHtml, /first Gold Bar purchase doubles/);
    assert.doesNotMatch(storeHtml, /Gold Bars — 1,300/);
    assert.doesNotMatch(storeHtml, /Gold Bars — 5,600/);
    assert.doesNotMatch(storeHtml, /30 days of Patron/);
    const boot = JSON.parse(storeHtml.match(/<script type="application\/json" id="paddle-boot">(.*?)<\/script>/s)[1]);
    assert.deepEqual(boot.catalog, [
      { priceId: 'pri_gold_10' },
      { priceId: 'pri_gold_25' },
      { priceId: 'pri_gold_50' },
      { priceId: 'pri_gold_100' },
    ]);
    assert.match(storeHtml, /cdn\.paddle\.com\/paddle\/v2\/paddle\.js/);
    assert.match(storeHtml, /Are you 18 or older/);
    assert.match(storeHtml, /data-age-yes/);
    assert.match(storeHtml, /data-age-no/);
    assert.doesNotMatch(storeHtml, /Accountant pass/);
    assert.doesNotMatch(storeHtml, /Get the pass/);
    assert.doesNotMatch(storeHtml, /"country":"OTHERS"/);
    const welcome = await fetch(`${base}/welcome`);
    assert.equal(welcome.status, 200);
    assert.match(await welcome.text(), /Payment received/);
    const legacySuccess = await fetch(`${base}/success`, { redirect: 'manual' });
    assert.equal(legacySuccess.status, 302);
    assert.equal(legacySuccess.headers.get('location'), '/welcome');
  });
});

test('live overlay omits Environment.set so Paddle.js defaults to production', () => {
  const src = readFileSync(new URL('../public/js/paddle-store.js', import.meta.url), 'utf8');
  assert.match(src, /Environment\.set\('sandbox'\)/);
  assert.doesNotMatch(src, /Environment\.set\(env\)/);
  assert.match(src, /displayMode: 'overlay'/);
  assert.match(src, /variant: 'one-page'/);
  assert.match(src, /formattedTotals/);
});

test('GET /market is watch-only for members and GET /api/market hides fair_price', async () => {
  const marketCache = {
    getSnapshot() {
      return {
        asOf: '2026-09-18T16:00:00.000Z',
        quotes: [
          { ticker: 'FUEL', name: 'Fuel', type: 'commodity', sector: 'logistics', price: '75.12', vol: 0, changes: { '7D': 0, '1M': -0.4, '6M': 0, '1Y': 0 } },
          { ticker: 'ACME', name: 'Acme Co', type: 'company', sector: 'retail', price: '12.50', vol: 0, cap: 5000, focus: 'Agri-Harvest', changes: { '7D': 0, '1M': 25, '6M': 0, '1Y': 0 } },
        ],
      };
    },
    async refresh() {},
    async getOhlc(ticker) {
      if (ticker !== 'FUEL') return null;
      return {
        ticker: 'FUEL',
        window: '1M',
        bars: [{ t: 946684800, o: 75.1, h: 75.8, l: 74.9, c: 75.2, v: 120 }],
      };
    },
  };
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {}, marketCache });
  const headers = { cookie: sessionCookie() };
  await withServer(app, async (base) => {
    const page = await fetch(`${base}/market`, { headers });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, />Market</);
    assert.match(html, /Trading happens in Discord/);
    assert.match(html, /FUEL/);
    assert.match(html, /ACME/);
    assert.match(html, /id="market-boot"/);
    assert.match(html, /data-window="1M"/);
    assert.match(html, /data-window="7D"/);
    assert.match(html, /id="market-heatmap"/);
    assert.match(html, /id="market-search"/);
    assert.match(html, /Agri-Harvest/);
    assert.match(html, /data-reset/);
    assert.doesNotMatch(html, /data-window="6h"/);
    assert.doesNotMatch(html, /data-window="24h"/);
    assert.match(html, /\/js\/lightweight-charts\.js/);
    assert.match(html, /What the city burns/);
    assert.doesNotMatch(html, /fair_price/);
    assert.doesNotMatch(html, /Buy Fuel/);
    const snap = await fetch(`${base}/api/market/snapshot`, { headers });
    assert.equal(snap.status, 200);
    assert.equal(snap.headers.get('cache-control'), 'private, no-store');
    assert.equal(page.headers.get('cache-control'), 'private, no-store');
    const json = await snap.json();
    assert.equal(json.quotes[0].ticker, 'FUEL');
    assert.doesNotMatch(JSON.stringify(json), /fair_price/);
    const ohlc = await fetch(`${base}/api/market/ohlc?ticker=FUEL&window=1M&_=cachebust`, { headers });
    assert.equal(ohlc.status, 200);
    const bars = await ohlc.json();
    assert.equal(bars.ticker, 'FUEL');
    assert.equal(bars.bars[0].c, 75.2);
    assert.doesNotMatch(JSON.stringify(bars), /fair_price/);
    assert.equal(bars.bars[0].v, 120);
    const bad = await fetch(`${base}/api/market/ohlc?ticker=../x`, { headers });
    assert.equal(bad.status, 404);
    const unknown = await fetch(`${base}/api/market/ohlc?ticker=NOPE`, { headers });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.headers.get('cache-control'), 'private, no-store');
  });
});

test('market is a 404 for logged-out visitors and no link to it is shown', async () => {
  const marketCache = {
    getSnapshot: () => ({ asOf: null, quotes: [] }),
    async refresh() {},
    async getOhlc() {
      return { ticker: 'FUEL', window: '1M', bars: [] };
    },
  };
  const app = createApp({ config: config(), db: mockDb(), art: {}, marketCache });
  await withServer(app, async (base) => {
    for (const path of ['/market', '/market?ticker=FUEL', '/api/market/snapshot', '/api/market/ohlc?ticker=FUEL']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 404, path);
      assert.equal(res.headers.get('cache-control'), 'private, no-store', path);
      const body = await res.text();
      assert.doesNotMatch(body, /id="market-boot"|market-heatmap/, path);
      if (path.startsWith('/api/')) assert.deepEqual(JSON.parse(body), { error: 'not found' }, path);
    }
    for (const path of ['/', '/store', '/legal']) {
      const html = await (await fetch(`${base}${path}`)).text();
      assert.doesNotMatch(html, /href="\/market"/, path);
      assert.doesNotMatch(html, /See the market/, path);
    }
    const member = await (await fetch(`${base}/`, { headers: { cookie: sessionCookie() } })).text();
    assert.match(member, /href="\/market"/);
  });
});

test('every one of the eight commodities has a market page line', async () => {
  const { COMMODITY_NOTES } = await import('../src/views/market.js');
  assert.deepEqual(Object.keys(COMMODITY_NOTES).sort(), [
    'COMP', 'FUEL', 'MACH', 'METL', 'PHRM', 'PRDC', 'RECL', 'TXTL',
  ]);
});

test('overlay POST returns the server-made transaction id and records who it is for', async () => {
  const cfg = config();
  const db = mockDb({ player: { id: 7, discord_id: '42' } });
  const app = createApp({
    config: cfg,
    db,
    art: {},
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { data: { id: 'txn_overlay', checkout: { url: 'https://sandbox-buy.paddle.com/checkout/txn_overlay' } } };
      },
      async text() {
        return '';
      },
    }),
  });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-25`, {
      method: 'POST',
      headers: {
        cookie: sessionCookie(),
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'age=yes&terms=yes&novalue=yes',
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { transactionId: 'txn_overlay' });
    assert.deepEqual(db.pendingOrders.get('txn_overlay'), { discord_id: '42', sku_key: 'gold-25' });
  });
});

test('webhook ignores custom_data: a transaction with no pending order grants nothing', async () => {
  const cfg = config();
  const db = mockDb({ player: { id: 7, discord_id: '42' } });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    event_id: 'evt_forged',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_forged',
      custom_data: { discord_id: '42', sku_key: 'gold-10' },
      items: [{ price: { id: 'pri_gold_10' } }],
    },
  });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/webhooks/paddle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': paddleSignature(raw, cfg.PADDLE_WEBHOOK_SECRET) },
      body: raw,
    });
    assert.equal(res.status, 200);
    assert.equal(db.statements.filter((s) => /gold_bars = gold_bars \+/.test(s.text)).length, 0);
  });
});

test('oauth callback needs the state cookie from the same browser (no login CSRF)', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const start = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const cb = await fetch(
      `${base}/api/auth/discord/callback?code=ok&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' },
    );
    assert.equal(cb.status, 302);
    assert.match(cb.headers.get('location'), /\/login\?error=oauth/);
    assert.doesNotMatch(cb.headers.get('set-cookie') || '', /mg_session=/);
  });
});

test('logout is POST-only and revokes the session on the server', async () => {
  const cfg = config();
  const db = mockDb();
  const app = createApp({ config: cfg, db, art: {} });
  await withServer(app, async (base) => {
    assert.equal((await fetch(`${base}/logout`, { redirect: 'manual' })).status, 404);
    const headers = { cookie: sessionCookie() };
    assert.equal((await fetch(`${base}/account`, { headers, redirect: 'manual' })).status, 200);
    const out = await fetch(`${base}/logout`, { method: 'POST', headers, redirect: 'manual' });
    assert.equal(out.status, 302);
    assert.match(out.headers.get('clear-site-data') || '', /cookies/);
    const after = await fetch(`${base}/account`, { headers, redirect: 'manual' });
    assert.equal(after.status, 302);
    assert.match(after.headers.get('location'), /^\/login/);
  });
});

test('log out everywhere drops every session of that player', async () => {
  const cfg = config();
  const db = mockDb();
  db.sessions.set('other-device', { discord_id: '42', username: 'ash', global_name: 'Ash', avatar: null, email: '' });
  const app = createApp({ config: cfg, db, art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/account/logout-all`, {
      method: 'POST',
      headers: { cookie: sessionCookie() },
      redirect: 'manual',
    });
    assert.equal(res.status, 302);
    assert.equal(db.sessions.size, 0);
  });
});

test('pages carry no inline styles and CSP drops unsafe-inline for styles', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.doesNotMatch(html, /\sstyle=/);
    assert.doesNotMatch(res.headers.get('content-security-policy') || '', /style-src[^;]*unsafe-inline/);
    const css = await (await fetch(`${base}/art.css`)).text();
    assert.match(css, /\.star-41\{/);
    assert.match(css, /\.ray-11\{transform:rotate\(330deg\)\}/);
  });
});
