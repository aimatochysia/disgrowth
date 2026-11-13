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
  GAME_TIME,
  createMarketCache,
  loadMarketOhlc,
  mapOhlcRows,
  normalizeChartWindow,
  publicQuote,
  resolveChartWindow,
  setGameTime,
  timeAgoLabel,
  toInGameUnix,
} from '../src/market.js';

test('market snapshot reads asset_quotes only, never fair_price or the point split', () => {
  assert.match(MARKET_SNAPSHOT_SQL, /FROM asset_quotes/);
  assert.doesNotMatch(MARKET_SNAPSHOT_SQL, /fair_price|recipe_points|discord_id|focus|market_cap/);
  // Commodities only (company stocks are not shown), and never a retired asset.
  assert.match(MARKET_SNAPSHOT_SQL, /type <> 'company'/);
  assert.match(MARKET_ASSET_SQL, /type <> 'company'/);
  assert.match(MARKET_SNAPSHOT_SQL, /\{active\}/);
  assert.match(MARKET_ASSET_SQL, /\{active\}/);
  assert.doesNotMatch(MARKET_ASSET_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /fair_price/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /macro_regime/);
  assert.match(MARKET_OHLC_SQL, /grain = \$2/);
  assert.match(MARKET_OHLC_SQL, /period_start >= \$3/);
  assert.match(MARKET_OHLC_SQL, /LIMIT \$4/);
  assert.doesNotMatch(MARKET_OHLC_SQL, /tick|open|high|low|volume/);
});

test('player columns and grants no longer mention marks', () => {
  assert.equal(PLAYER_COLUMNS.includes('marks'), false);
  assert.doesNotMatch(GOLD_GRANT_SQL, /\bmarks\b/);
  assert.doesNotMatch(GOLD_REFUND_SQL, /\bmarks\b/);
});

test('publicQuote drops unknown tickers and copies only what the page shows', () => {
  assert.equal(publicQuote({ ticker: '../x', price: 1 }), null);
  const quote = publicQuote({
    ticker: 'fuel',
    name: 'Fuel',
    type: 'commodity',
    sector: 'logistics',
    price: 75.12,
    volume: 120.4,
    change_7d: '1.5',
    change_1m: '-0.40',
    change_6m: '3',
    change_1y: '9',
    market_cap: 5000,
    focus: 'Bio-Med',
    fair_price: 999,
    recipe_points: { PHRM: 3 },
    discord_id: 'nope',
  });
  assert.deepEqual(quote, {
    ticker: 'FUEL',
    name: 'Fuel',
    price: '75.12',
    vol: 120,
    changes: { '7D': 1.5, '1M': -0.4, '6M': 3, '1Y': 9 },
  });
});

test('setGameTime applies the bot clock and ignores junk', () => {
  const before = { ...GAME_TIME };
  setGameTime({ realMsPerInGameDay: 0, inGameDaysPerMonth: 30, inGameMonthsPerYear: 12, epoch: 'nope' });
  assert.deepEqual(GAME_TIME, before);
  setGameTime({ ...before, realMsPerInGameDay: 1800000 });
  assert.equal(GAME_TIME.realMsPerInGameDay, 1800000);
  setGameTime(before);
});

test('in-game windows map wall-clock onto in-game seconds', () => {
  assert.equal(DEFAULT_CHART_WINDOW, '1M');
  assert.equal(normalizeChartWindow('24h'), '1M');
  assert.equal(normalizeChartWindow('6h'), '1M');
  assert.equal(normalizeChartWindow('7d'), '7D');
  assert.equal(normalizeChartWindow('ytd'), '1Y');
  assert.equal(normalizeChartWindow('nope'), '1M');
  assert.equal(toInGameUnix('2026-01-01T00:00:00.000Z'), 0);
  assert.equal(toInGameUnix('2026-01-01T01:00:00.000Z'), 86400);
  const now = new Date('2026-09-19T07:00:00.000Z');
  const oneM = resolveChartWindow('1M', now);
  assert.equal(oneM.key, '1M');
  assert.equal(oneM.grain, 'day');
  assert.equal(now.getTime() - oneM.start.getTime(), 30 * 60 * 60 * 1000);
  assert.equal(now.getTime() - resolveChartWindow('7D', now).start.getTime(), 7 * 60 * 60 * 1000);
  assert.equal(now.getTime() - resolveChartWindow('1Y', now).start.getTime(), 360 * 60 * 60 * 1000);
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
  assert.equal(bars[0].t, 0);
  assert.equal(bars[0].c, 100.5);
  assert.equal(bars[1].t, 86400);
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
      return { ticker, window: windowKey, bars: [{ t: 946684800, c: 1.5 }] };
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
  assert.equal(fuel.bars[0].c, 1.5);
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
  assert.equal(payload.bars[0].c, 75.2);
  assert.deepEqual(Object.keys(payload.bars[0]).sort(), ['ago', 'c', 't']);
  assert.doesNotMatch(JSON.stringify(payload), /fair_price/);
  const fiveY = await loadMarketOhlc(db, 'FUEL', '5Y', now);
  assert.equal(fiveY.window, '5Y');
  assert.deepEqual(grains, ['day', 'month', 'day']);
});

test('market client pins the axis and draws a close line', () => {
  const src = readFileSync(fileURLToPath(new URL('../public/js/market.js', import.meta.url)), 'utf8');
  assert.match(src, /fixLeftEdge: true/);
  assert.match(src, /fixRightEdge: true/);
  assert.doesNotMatch(src, /data-reset|data-ind|sma20/);
  assert.match(src, /market-formula\.js/);
  assert.doesNotMatch(src, /method: 'POST'|sendBeacon|XMLHttpRequest/);
  assert.match(src, /fitContent/);
  assert.match(src, /'1M'/);
  assert.match(src, /'1Y'/);
  assert.match(src, /addLineSeries/);
  assert.doesNotMatch(src, /addCandlestickSeries|addHistogramSeries/);
  assert.doesNotMatch(src, /heatmap|market-filter/);
});

// Lockstep with bot `src/engine/timeLabels.test.js`: same table, now mid-day at a month start (day 12000.5).
test('timeAgoLabel ladder matches the bot', () => {
  const now = 12000;
  const table = [
    [0, 'today'], [1, 'yesterday'], [2, '2 days ago'], [13, '13 days ago'],
    [30, 'last month'], [60, '2 months ago'], [330, '11 months ago'], [360, 'last year'], [720, '2 years ago'],
  ];
  for (const [days, want] of table) assert.equal(timeAgoLabel(now - days, now, 'day'), want, `${days} days`);
  assert.equal(timeAgoLabel(now, now, 'month'), 'today');
  assert.equal(timeAgoLabel(now - 90, now, 'month'), '3 months ago');
});

test('chart formulas: parsed here, never eval, bad input throws a short message', async () => {
  const { evaluate } = await import('../public/js/market-formula.js');
  const bars = [1, 2, 3, 4, 5].map((c, t) => ({ t, c }));
  assert.deepEqual(evaluate('sma(close, 2)', bars).map((p) => p.value), [1.5, 2.5, 3.5, 4.5]);
  assert.deepEqual(evaluate('hi(close, 3) - lo(close, 3)', bars).map((p) => p.value), [2, 2, 2]);
  assert.deepEqual(evaluate('-close * 2 + 1', bars).map((p) => p.value), [-1, -3, -5, -7, -9]);
  assert.equal(evaluate('ema(close, 1)', bars).at(-1).value, 5);
  assert.equal(evaluate('close / 0', bars).length, 0);
  for (const bad of ['', 'open', 'volume', 'x'.repeat(121), 'process.exit()', 'foo(1)', 'sma(close)', 'sma(close, close)', 'close +', 'sma(close, 2) )', '('.repeat(12) + 'close' + ')'.repeat(12)]) {
    assert.throws(() => evaluate(bad, bars), Error, bad);
  }
});
