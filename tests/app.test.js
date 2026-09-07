import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/create-app.js';
import { loadConfig } from '../src/config.js';
import { seal } from '../src/session.js';

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

function mockDb({ player = null, seen = new Set(), grants = [] } = {}) {
  const statements = [];
  const firstPurchase = new Map();
  const orders = [];
  return {
    statements,
    async health() {
      return 'up';
    },
    async findPlayerByDiscordId(id) {
      if (player && String(player.discord_id) === String(id)) return player;
      return null;
    },
    async hasUsedFirstPurchase(id) {
      return firstPurchase.has(String(id));
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

function sessionCookie(cfg, discordId = '42') {
  const token = seal(
    { discordId, username: 'ash', globalName: 'Ash', avatar: null, createdAt: Date.now() },
    cfg.SESSION_SECRET,
  );
  return `mg_session=${token}`;
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
    const html = await home.text();
    assert.match(html, /Disgrowth/);
    const store = await fetch(`${base}/store`);
    assert.equal(store.status, 200);
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    const json = await health.json();
    assert.equal(json.ok, true);
    assert.equal(json.db, 'down');
    assert.equal(json.checkout, false);
    assert.ok(json.missing.some((item) => /localhost/.test(item)));
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

test('GET /healthz', async () => {
  const cfg = config();
  const app = createApp({ config: cfg, db: mockDb(), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.db, 'up');
  });
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
  const app = createApp({
    config: cfg,
    db: mockDb({ player }),
    art: {},
    fetchImpl: async (url, opts) => {
      calls.push({ url: String(url), opts });
      return {
        ok: true,
        async json() {
          return { data: { checkout: { url: 'https://sandbox-buy.paddle.com/checkout/txn_test' } } };
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
    assert.equal(sent.custom_data.discord_id, '42');
    assert.equal(sent.custom_data.sku_key, 'gold-10');
    assert.equal(sent.checkout.settings.success_url, 'http://127.0.0.1/success');
  });
});

test('/buy with player shows first-purchase double copy', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const app = createApp({ config: cfg, db: mockDb({ player }), art: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/buy/gold-10`, {
      headers: { cookie: sessionCookie(cfg) },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /1,000 Gold Bars/);
    assert.match(html, /double the listed Gold Bars/);
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
  const db = mockDb({ player });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    event_id: 'evt_5001',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_5001',
      custom_data: { discord_id: '42', sku_key: 'gold-10' },
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
    assert.equal(grants[0].params[0], 1000);
  });
});

test('second gold-10 purchase is catalog amount, not doubled', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player });
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
          custom_data: { discord_id: '42', sku_key: 'gold-10' },
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
    assert.equal(grants[0].params[0], 1000);
    assert.equal(grants[1].params[0], 500);
  });
});

test('gold-25 transaction.completed extends Patron', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    event_id: 'evt_5002',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_5002',
      custom_data: { discord_id: '42', sku_key: 'gold-25' },
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
    assert.equal(grants[0].params[0], 2600);
    const patron = db.statements.filter((s) => /INTERVAL '1 day'/.test(s.text));
    assert.equal(patron.length, 1);
    assert.equal(patron[0].params[1], 30);
  });
});

test('refund of a doubled first purchase reverses stored gold_delta', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player });
  const app = createApp({ config: cfg, db, art: {} });
  const paid = JSON.stringify({
    event_id: 'evt_bonus',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_bonus',
      custom_data: { discord_id: '42', sku_key: 'gold-10' },
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
    assert.equal(refunds[0].params[0], 1000);
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
    assert.match(html, />Terms</);
    assert.match(html, /btn-discord/);
    assert.match(html, /In the city/);
    assert.match(html, /Start here/);
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
    assert.match(legalHtml, /Patron time included with a Gold Bar pack is/);
    assert.match(legalHtml, /First Gold Bar purchase/);
    assert.match(legalHtml, /Paddle/);
    assert.match(legalHtml, /do not publish a street address/);
    assert.doesNotMatch(legalHtml, /Lemon Squeezy/);
    assert.doesNotMatch(legalHtml, /address not yet published/);
    assert.doesNotMatch(legalHtml, /Delaware/);
    const store = await fetch(`${base}/store`);
    const storeHtml = await store.text();
    assert.match(storeHtml, /Gold Bars — 500/);
    assert.match(storeHtml, /Gold Bars — 5,600/);
    assert.match(storeHtml, /first Gold Bar purchase doubles/);
    assert.match(storeHtml, /Are you 18 or older/);
    assert.match(storeHtml, /data-age-yes/);
    assert.match(storeHtml, /data-age-no/);
    assert.doesNotMatch(storeHtml, /Accountant pass/);
    assert.doesNotMatch(storeHtml, /Get the pass/);
  });
});
