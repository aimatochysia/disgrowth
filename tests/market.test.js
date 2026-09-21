import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MARKET_ASSET_SQL,
  MARKET_OHLC_SQL,
  MARKET_SNAPSHOT_SQL,
  PLAYER_COLUMNS,
} from '../src/db.js';
import { GOLD_GRANT_SQL, GOLD_REFUND_SQL } from '../src/grants.js';
import {
  DEFAULT_CHART_WINDOW,
  bucketBars,
  createMarketCache,
  loadMarketOhlc,
  mapOhlcRows,
  normalizeChartWindow,
  publicQuote,
  resolveChartWindow,
  toInGameUnix,
} from '../src/market.js';

test('market snapshot SQL reads listed prices and never fair_price', () => {
  assert.match(MARKET_SNAPSHOT_SQL, /a\.current_price AS price/);
  assert.match(MARKET_SNAPSHOT_SQL, /NULLIF\(ph\.close, 0\)/);
  assert.doesNotMatch(MARKET_SNAPSHOT_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_SNAPSHOT_SQL, /discord_id/);
  assert.doesNotMatch(MARKET_ASSET_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /macro_regime/);
  assert.match(MARKET_OHLC_SQL, /grain = \$2/);
  assert.match(MARKET_OHLC_SQL, /period_start >= \$3/);
  assert.match(MARKET_OHLC_SQL, /LIMIT \$4/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /tick/);
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

test('in-game windows map wall-clock onto the fictional calendar', () => {
  assert.equal(DEFAULT_CHART_WINDOW, '1M');
  assert.equal(normalizeChartWindow('24h'), '1M');
  assert.equal(normalizeChartWindow('6h'), '1M');
  assert.equal(normalizeChartWindow('7d'), '6M');
  assert.equal(normalizeChartWindow('nope'), '1M');
  assert.equal(toInGameUnix('2026-01-01T00:00:00.000Z'), 946684800);
  assert.equal(toInGameUnix('2026-01-01T01:00:00.000Z'), 946684800 + 86400);
  const now = new Date('2026-09-19T07:00:00.000Z');
  const oneM = resolveChartWindow('1M', now);
  assert.equal(oneM.key, '1M');
  assert.equal(oneM.grain, 'day');
  assert.equal(now.getTime() - oneM.start.getTime(), 30 * 60 * 60 * 1000);
  const ytd = resolveChartWindow('YTD', now);
  assert.equal(ytd.grain, 'day');
  assert.ok(ytd.start.getTime() >= Date.parse('2026-01-01T00:00:00.000Z'));
  assert.ok(ytd.start.getTime() < now.getTime());
  const fiveY = resolveChartWindow('5Y', now);
  assert.equal(fiveY.grain, 'month');
  const all = resolveChartWindow('ALL', now);
  assert.equal(all.start.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('mapOhlcRows uses in-game unix and skips zero closes', () => {
  const bars = mapOhlcRows([
    {
      period_start: '2026-01-01T00:00:00.000Z',
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      price: 100.5,
      volume: 12,
      fair_price: 999,
    },
    {
      period_start: '2026-01-01T01:00:00.000Z',
      open: 101,
      high: 102,
      low: 99,
      close: 100,
      price: 100,
      volume: 8,
    },
  ]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0].t, 946684800);
  assert.equal(bars[0].c, 100.5);
  assert.equal(Object.hasOwn(bars[0], 'v'), false);
  assert.equal(bars[1].t, 946771200);
  assert.equal(Object.hasOwn(bars[0], 'fair_price'), false);
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
  assert.equal(Object.hasOwn(bars[0], 'v'), false);
  assert.equal(Object.hasOwn(bars[0], 'fair_price'), false);
});

test('market cache coalesces snapshot loads and 404s', async () => {
  let loads = 0;
  let ohlcLoads = 0;
  const cache = createMarketCache({
    ttlMs: 60_000,
    loadSnapshot: async () => {
      loads += 1;
      return [{ ticker: 'FUEL', name: 'Fuel', type: 'commodity', price: 75, open_price: 74 }];
    },
    loadOhlc: async (ticker, windowKey) => {
      ohlcLoads += 1;
      if (ticker === 'NOPE') return null;
      return { ticker, window: windowKey, bars: [{ t: 946684800, o: 1, h: 2, l: 1, c: 1.5, v: 4 }] };
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
  const fuel = await cache.getOhlc('FUEL', '24h');
  assert.equal(fuel.window, '1M');
  assert.equal(Object.hasOwn(fuel.bars[0], 'v'), false);
  const afterFuel = ohlcLoads;
  const missA = await cache.getOhlc('NOPE', '1M');
  const missB = await cache.getOhlc('NOPE', '1M');
  assert.equal(missA, null);
  assert.equal(missB, null);
  assert.equal(ohlcLoads, afterFuel + 1);
  cache.stop();
});

test('loadMarketOhlc never scans ticks and aliases old windows', async () => {
  const grains = [];
  const db = {
    async findMarketAsset(ticker) {
      return ticker === 'FUEL' ? { id: 1, ticker: 'FUEL', current_price: 75.2 } : null;
    },
    async listMarketHistory(query) {
      grains.push(query.grain);
      assert.notEqual(query.grain, 'tick');
      assert.ok(query.limit <= 400);
      if (query.grain === 'month') return [];
      return [
        {
          period_start: '2026-09-18T06:00:00Z',
          recorded_at: '2026-09-18T06:59:59Z',
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
  assert.equal(await loadMarketOhlc(db, '../x', '1M', now), null);
  assert.equal(await loadMarketOhlc(db, 'NOPE', '1M', now), null);
  const payload = await loadMarketOhlc(db, 'FUEL', '24h', now);
  assert.equal(payload.ticker, 'FUEL');
  assert.equal(payload.window, '1M');
  assert.ok(payload.bars.length >= 1);
  assert.equal(Object.hasOwn(payload.bars[0], 'v'), false);
  assert.doesNotMatch(JSON.stringify(payload), /fair_price/);
  const fiveY = await loadMarketOhlc(db, 'FUEL', '5Y', now);
  assert.equal(fiveY.window, '5Y');
  assert.deepEqual(grains, ['day', 'month', 'day']);
});

test('market client pins the axis and never draws volume', () => {
  const src = readFileSync(fileURLToPath(new URL('../public/js/market.js', import.meta.url)), 'utf8');
  assert.match(src, /fixLeftEdge: true/);
  assert.match(src, /fixRightEdge: true/);
  assert.match(src, /data-reset/);
  assert.match(src, /fitContent/);
  assert.match(src, /'1M'/);
  assert.match(src, /'YTD'/);
  assert.doesNotMatch(src, /addHistogramSeries/);
  assert.doesNotMatch(src, /volumeSeries/);
});
