import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { seal } from '../src/session.js';

function config(over = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-session-secret-32-characters-min',
    STORE_ORIGIN: 'http://127.0.0.1',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'http://127.0.0.1/api/auth/discord/callback',
    LEMONSQUEEZY_STORE_ID: '1',
    LEMONSQUEEZY_WEBHOOK_SECRET: 'whsec',
    LEMONSQUEEZY_CHECKOUT_BASE: 'https://store.lemonsqueezy.com/checkout/buy',
    LEMONSQUEEZY_VARIANT_GOLD_10: '111',
    LEMONSQUEEZY_VARIANT_GOLD_25: '222',
    LEMONSQUEEZY_VARIANT_GOLD_50: '444',
    LEMONSQUEEZY_VARIANT_GOLD_100: '555',
    ...over,
  });
}

function mockDb({ player = null, seen = new Set() } = {}) {
  const statements = [];
  return {
    statements,
    async health() {
      return 'up';
    },
    async findPlayerByDiscordId(id) {
      if (player && String(player.discord_id) === String(id)) return player;
      return null;
    },
    async withTransaction(fn) {
      const client = {
        async query(text, params) {
          if (/INSERT INTO store_orders/.test(text)) {
            const eventId = params[0];
            if (seen.has(eventId)) {
              const err = new Error('duplicate');
              err.code = '23505';
              throw err;
            }
            seen.add(eventId);
          }
          statements.push({ text, params });
          if (/FOR UPDATE/.test(text)) {
            return { rows: player ? [player] : [] };
          }
          return { rows: [] };
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

test('/buy without player row does not redirect to Lemon Squeezy', async () => {
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
    assert.doesNotMatch(html, /lemonsqueezy.com/);
  });
});

test('POST /buy without player does not 302 to Lemon Squeezy', async () => {
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
    const res = await fetch(`${base}/api/webhooks/lemonsqueezy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': '00' },
      body: '{}',
    });
    assert.equal(res.status, 401);
  });
});

test('idempotent double order_created does not grant twice', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    meta: {
      event_name: 'order_created',
      custom_data: { discord_id: '42', sku_key: 'gold-10' },
    },
    data: {
      id: '5001',
      attributes: { store_id: 1, first_order_item: { variant_id: 111 } },
    },
  });
  const sig = createHmac('sha256', cfg.LEMONSQUEEZY_WEBHOOK_SECRET).update(raw).digest('hex');

  await withServer(app, async (base) => {
    const post = () =>
      fetch(`${base}/api/webhooks/lemonsqueezy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': sig },
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
  });
});

test('gold-25 order_created extends Patron', async () => {
  const cfg = config();
  const player = { id: 7, discord_id: '42' };
  const db = mockDb({ player });
  const app = createApp({ config: cfg, db, art: {} });
  const raw = JSON.stringify({
    meta: {
      event_name: 'order_created',
      custom_data: { discord_id: '42', sku_key: 'gold-25' },
    },
    data: {
      id: '5002',
      attributes: { store_id: 1, first_order_item: { variant_id: 222 } },
    },
  });
  const sig = createHmac('sha256', cfg.LEMONSQUEEZY_WEBHOOK_SECRET).update(raw).digest('hex');

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/webhooks/lemonsqueezy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': sig },
      body: raw,
    });
    assert.equal(res.status, 200);
    const grants = db.statements.filter((s) => /gold_bars = gold_bars \+/.test(s.text));
    assert.equal(grants.length, 1);
    assert.equal(grants[0].params[0], 1300);
    const patron = db.statements.filter((s) => /INTERVAL '1 day'/.test(s.text));
    assert.equal(patron.length, 1);
    assert.equal(patron[0].params[1], 30);
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
    const store = await fetch(`${base}/store`);
    const storeHtml = await store.text();
    assert.match(storeHtml, /Gold Bars — 500/);
    assert.match(storeHtml, /Gold Bars — 5,600/);
    assert.doesNotMatch(storeHtml, /Accountant pass/);
    assert.doesNotMatch(storeHtml, /Get the pass/);
  });
});
