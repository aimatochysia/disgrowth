import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MARKET_ASSET_SQL,
  MARKET_OHLC_SQL,
  MARKET_SNAPSHOT_SQL,
  PLAYER_COLUMNS,
} from '../src/db.js';
import { GOLD_GRANT_SQL, GOLD_REFUND_SQL } from '../src/grants.js';
import {
  bucketBars,
  createMarketCache,
  loadMarketOhlc,
  publicQuote,
  resolveChartWindow,
} from '../src/market.js';

test('market snapshot SQL reads listed prices and never fair_price', () => {
  assert.match(MARKET_SNAPSHOT_SQL, /a\.current_price AS price/);
  assert.doesNotMatch(MARKET_SNAPSHOT_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_SNAPSHOT_SQL, /discord_id/);
  assert.doesNotMatch(MARKET_ASSET_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /macro_regime/);
  assert.match(MARKET_OHLC_SQL, /LIMIT \$4/);
});

test('player columns and grants no longer mention marks', () => {
  assert.equal(PLAYER_COLUMNS.includes('marks'), false);
  assert.doesNotMatch(GOLD_GRANT_SQL, /\bmarks\b/);
  assert.doesNotMatch(GOLD_REFUND_SQL, /\bmarks\b/);
});

test('publicQuote drops unknown tickers and never copies fair_price', () => {
  assert.equal(publicQuote({ ticker: '../x', price: 1 }), null);
  const quote = publicQuote({
    ticker: 'fuel',
    name: 'Fuel',
    type: 'commodity',
    sector: 'logistics',
    price: 75.12,
    open_price: 75.42,
    fair_price: 999,
    discord_id: 'nope',
  });
  assert.deepEqual(quote, {
    ticker: 'FUEL',
    name: 'Fuel',
    type: 'commodity',
    sector: 'logistics',
    price: '75.12',
    changePct: '-0.40',
  });
  assert.equal(Object.hasOwn(quote, 'fair_price'), false);
});

test('bucketBars downsamples ticks without a fair line', () => {
  const start = new Date('2026-09-18T00:00:00Z');
  const end = new Date('2026-09-18T04:00:00Z');
  const rows = [
    { recorded_at: '2026-09-18T00:10:00Z', price: 10, volume: 2, fair_price: 99 },
    { recorded_at: '2026-09-18T00:20:00Z', price: 12, volume: 3, fair_price: 99 },
    { recorded_at: '2026-09-18T02:10:00Z', price: 11, volume: 1, fair_price: 99 },
  ];
  const bars = bucketBars(rows, start, end, 2);
  assert.equal(bars.length, 2);
  assert.equal(bars[0].o, 10);
  assert.equal(bars[0].h, 12);
  assert.equal(bars[0].c, 12);
  assert.equal(bars[0].v, 5);
  assert.equal(Object.hasOwn(bars[0], 'fair_price'), false);
});

test('market cache coalesces snapshot loads', async () => {
  let loads = 0;
  const cache = createMarketCache({
    ttlMs: 60_000,
    loadSnapshot: async () => {
      loads += 1;
      return [{ ticker: 'FUEL', name: 'Fuel', type: 'commodity', price: 75, open_price: 74 }];
    },
  });
  const a = cache.refresh();
  const b = cache.refresh();
  await Promise.all([a, b]);
  assert.equal(loads, 1);
  const snap = cache.getSnapshot();
  assert.equal(snap.quotes[0].ticker, 'FUEL');
  await cache.refresh();
  assert.equal(loads, 1);
  cache.stop();
});

test('loadMarketOhlc 404s unknown symbols and omits fair_price', async () => {
  const db = {
    async findMarketAsset(ticker) {
      return ticker === 'FUEL' ? { id: 1, ticker: 'FUEL' } : null;
    },
    async listMarketHistory() {
      return [
        {
          recorded_at: '2026-09-18T12:00:00Z',
          price: 75.2,
          open: 75.1,
          high: 75.8,
          low: 74.9,
          close: 75.2,
          volume: 120,
          fair_price: 88,
        },
      ];
    },
  };
  const now = new Date('2026-09-18T16:00:00Z');
  assert.equal(await loadMarketOhlc(db, '../x', '24h', now), null);
  assert.equal(await loadMarketOhlc(db, 'NOPE', '24h', now), null);
  const payload = await loadMarketOhlc(db, 'FUEL', '24h', now);
  assert.equal(payload.ticker, 'FUEL');
  assert.equal(payload.window, '24h');
  assert.ok(payload.bars.length >= 1);
  assert.doesNotMatch(JSON.stringify(payload), /fair_price/);
  assert.equal(resolveChartWindow('nope').key, '24h');
});
