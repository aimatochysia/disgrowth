import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicLoginCache, sanitizeMarketTicker, sanitizeMarketWindow } from '../src/prefs.js';
import { CHART_WINDOW_KEYS } from '../src/market.js';

test('publicLoginCache never includes discordId, email, or tokens', () => {
  assert.deepEqual(publicLoginCache(null), { loggedIn: false });
  const out = publicLoginCache({
    discordId: '657734100060340273',
    email: 'a@b.c',
    username: 'petra',
    globalName: 'Petra',
    avatar: 'abc123',
    accessToken: 'secret',
  });
  assert.deepEqual(out, {
    loggedIn: true,
    username: 'petra',
    globalName: 'Petra',
    avatar: 'abc123',
  });
  assert.equal(Object.hasOwn(out, 'discordId'), false);
  assert.equal(Object.hasOwn(out, 'email'), false);
  assert.equal(Object.hasOwn(out, 'accessToken'), false);
  assert.equal(JSON.stringify(out).includes('657734100060340273'), false);
});

test('sanitizeMarketWindow matches live chart keys and aliases, rejects junk', () => {
  assert.deepEqual(CHART_WINDOW_KEYS, ['1M', '6M', 'YTD', '5Y', 'ALL']);
  assert.equal(sanitizeMarketWindow(''), '');
  assert.equal(sanitizeMarketWindow('nope'), '');
  assert.equal(sanitizeMarketWindow('1;DROP'), '');
  assert.equal(sanitizeMarketWindow('1M'), '1M');
  assert.equal(sanitizeMarketWindow('YTD'), 'YTD');
  assert.equal(sanitizeMarketWindow('all'), 'ALL');
  assert.equal(sanitizeMarketWindow('24h'), '1M');
  assert.equal(sanitizeMarketWindow('6h'), '1M');
  assert.equal(sanitizeMarketWindow('7d'), '6M');
  assert.equal(sanitizeMarketTicker('../x'), '');
  assert.equal(sanitizeMarketTicker('fuel'), 'FUEL');
  assert.equal(sanitizeMarketTicker('FUEL;DROP'), '');
});

test('client vault and market scripts keep the live window keys and omit discordId', () => {
  const vaultSrc = readFileSync(fileURLToPath(new URL('../public/js/vault.js', import.meta.url)), 'utf8');
  const marketSrc = readFileSync(fileURLToPath(new URL('../public/js/market.js', import.meta.url)), 'utf8');
  assert.match(vaultSrc, /'1M', '6M', 'YTD', '5Y', 'ALL'/);
  assert.match(vaultSrc, /AES-GCM/);
  assert.doesNotMatch(vaultSrc, /discordId/);
  assert.match(marketSrc, /DisgrowthVault/);
  assert.match(marketSrc, /fromTickerQuery/);
  assert.match(marketSrc, /fromWindowQuery/);
});
