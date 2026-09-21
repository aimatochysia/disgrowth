import { sanitizeTicker } from './ticker.js';

/** Keep in lockstep with bot `src/config/game.config.js` `time`. */
export const GAME_TIME = {
  realMsPerInGameDay: 60 * 60 * 1000,
  inGameDaysPerMonth: 30,
  inGameMonthsPerYear: 12,
  epoch: '2026-01-01T00:00:00.000Z',
  calendarEpoch: '2000-01-01',
};

export const MARKET_CACHE_TTL_MS = 15_000;
export const MARKET_OHLC_CACHE_MAX = 64;
export const MARKET_BAR_CAP = 400;
export const DEFAULT_CHART_WINDOW = '1M';
export const CHART_WINDOW_KEYS = ['1M', '6M', 'YTD', '5Y', 'ALL'];

export const CHART_WINDOWS = {
  '1M': { key: '1M', label: '1M', grain: 'day', inGameDays: 30, targetBars: 36 },
  '6M': { key: '6M', label: '6M', grain: 'day', inGameDays: 180, targetBars: 188 },
  YTD: { key: 'YTD', label: 'YTD', grain: 'day', ytd: true, targetBars: 368 },
  '5Y': { key: '5Y', label: '5Y', grain: 'month', inGameMonths: 60, targetBars: 64 },
  ALL: { key: 'ALL', label: 'ALL', grain: 'month', fromEpoch: true, targetBars: 240 },
};

const WINDOW_ALIASES = {
  '6h': '1M',
  '24h': '1M',
  '7d': '6M',
  '1m': '1M',
  '6m': '6M',
  ytd: 'YTD',
  '5y': '5Y',
  all: 'ALL',
};

export function normalizeChartWindow(windowKey) {
  const raw = String(windowKey || '').trim();
  if (CHART_WINDOWS[raw]) return raw;
  const alias = WINDOW_ALIASES[raw] || WINDOW_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const upper = raw.toUpperCase();
  if (CHART_WINDOWS[upper]) return upper;
  return DEFAULT_CHART_WINDOW;
}

export function inGameDayIndex(at, time = GAME_TIME) {
  const epochMs = Date.parse(time.epoch);
  const elapsed = new Date(at).getTime() - epochMs;
  return elapsed / (Number(time.realMsPerInGameDay) || 3_600_000);
}

export function toInGameUnix(at, time = GAME_TIME) {
  const dayIndex = inGameDayIndex(at, time);
  const [year, month, day] = String(time.calendarEpoch || '2000-01-01')
    .slice(0, 10)
    .split('-')
    .map((n) => Number(n));
  const calendarMs = Date.UTC(year, month - 1, day) + dayIndex * 86_400_000;
  return Math.floor(calendarMs / 1000);
}

export function resolveChartWindow(windowKey, now = new Date(), time = GAME_TIME) {
  const key = normalizeChartWindow(windowKey);
  const window = CHART_WINDOWS[key];
  const end = now instanceof Date ? now : new Date(now);
  const epochMs = Date.parse(time.epoch);
  const dayMs = Number(time.realMsPerInGameDay) || 3_600_000;
  const daysPerMonth = Number(time.inGameDaysPerMonth) || 30;
  const monthsPerYear = Number(time.inGameMonthsPerYear) || 12;
  let start;
  if (window.fromEpoch) {
    start = new Date(epochMs);
  } else if (window.ytd) {
    const dayIndex = Math.max(0, Math.floor(inGameDayIndex(end, time)));
    const yearLength = daysPerMonth * monthsPerYear;
    const yearStartDay = Math.floor(dayIndex / yearLength) * yearLength;
    start = new Date(epochMs + yearStartDay * dayMs);
  } else if (window.inGameMonths) {
    start = new Date(end.getTime() - window.inGameMonths * daysPerMonth * dayMs);
  } else {
    start = new Date(end.getTime() - (window.inGameDays || 30) * dayMs);
  }
  if (start.getTime() < epochMs) start = new Date(epochMs);
  if (start.getTime() > end.getTime()) start = new Date(end);
  return { ...window, start, end };
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function changePct(price, openPrice) {
  const now = Number(price);
  const open = Number(openPrice);
  if (!Number.isFinite(now) || !Number.isFinite(open) || open === 0) return '0.00';
  return (((now - open) / open) * 100).toFixed(2);
}

function round4(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function publicQuote(row) {
  const ticker = sanitizeTicker(row?.ticker);
  if (!ticker) return null;
  const price = money(row.price);
  if (!price) return null;
  const type = row.type === 'company' ? 'company' : 'commodity';
  const name = String(row.name || ticker).slice(0, 80);
  const sector = row.sector ? String(row.sector).slice(0, 32) : '';
  return {
    ticker,
    name,
    type,
    sector,
    price,
    changePct: changePct(row.price, row.open_price),
  };
}

export function publicSnapshot(rows, asOf = new Date()) {
  const quotes = [];
  for (const row of rows || []) {
    const quote = publicQuote(row);
    if (quote) quotes.push(quote);
  }
  return { asOf: asOf.toISOString(), quotes };
}

export function publicBar(row) {
  const t = Number(row?.t);
  const o = round4(row?.o);
  const h = round4(row?.h);
  const l = round4(row?.l);
  const c = round4(row?.c);
  if (!Number.isFinite(t) || o == null || h == null || l == null || c == null) return null;
  if (o <= 0 || h <= 0 || l <= 0 || c <= 0) return null;
  return { t, o, h, l, c };
}

export function publicOhlc(ticker, windowKey, bars) {
  const symbol = sanitizeTicker(ticker);
  const window = normalizeChartWindow(windowKey);
  const cleaned = [];
  for (const row of bars || []) {
    const bar = publicBar(row);
    if (bar) cleaned.push(bar);
    if (cleaned.length >= MARKET_BAR_CAP) break;
  }
  return { ticker: symbol, window, bars: cleaned };
}

function priceOf(row) {
  return finitePositive(row?.close) ?? finitePositive(row?.price) ?? finitePositive(row?.open);
}

export function mapOhlcRows(rows, time = GAME_TIME) {
  const bars = [];
  for (const row of rows || []) {
    const at = row.period_start || row.recorded_at;
    const price = priceOf(row);
    if (price == null) continue;
    const open = finitePositive(row.open) ?? price;
    const close = finitePositive(row.close) ?? price;
    const high = finitePositive(row.high) ?? Math.max(open, close, price);
    const low = finitePositive(row.low) ?? Math.min(open, close, price);
    const bar = publicBar({
      t: toInGameUnix(at, time),
      o: open,
      h: Math.max(high, open, close),
      l: Math.min(low, open, close),
      c: close,
    });
    if (bar) bars.push(bar);
    if (bars.length >= MARKET_BAR_CAP) break;
  }
  return bars;
}

export function bucketBars(rows, start, end, candleCount) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const count = Math.max(1, Number(candleCount) || 48);
  const bucketMs = (endMs - startMs) / count;
  const buckets = Array.from({ length: count }, (_unused, index) => ({
    start: startMs + index * bucketMs,
    open: null,
    high: null,
    low: null,
    close: null,
    samples: 0,
  }));

  const sorted = [...(rows || [])].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  for (const row of sorted) {
    const at = new Date(row.recorded_at).getTime();
    if (at < startMs || at >= endMs) continue;
    const index = Math.min(Math.max(Math.floor((at - startMs) / bucketMs), 0), count - 1);
    const price = priceOf(row);
    if (price == null) continue;
    const bucket = buckets[index];
    if (bucket.samples === 0) {
      bucket.open = price;
      bucket.high = price;
      bucket.low = price;
    } else {
      bucket.high = Math.max(bucket.high, finitePositive(row.high) || price);
      bucket.low = Math.min(bucket.low, finitePositive(row.low) || price);
    }
    bucket.close = price;
    bucket.samples += 1;
  }

  const bars = [];
  for (const bucket of buckets) {
    if (bucket.samples === 0) continue;
    const bar = publicBar({
      t: toInGameUnix(bucket.start),
      o: bucket.open,
      h: bucket.high,
      l: bucket.low,
      c: bucket.close,
    });
    if (bar) bars.push(bar);
    if (bars.length >= MARKET_BAR_CAP) break;
  }
  return bars;
}

export async function loadMarketOhlc(db, ticker, windowKey, now = new Date()) {
  if (!db || typeof db.findMarketAsset !== 'function' || typeof db.listMarketHistory !== 'function') {
    return null;
  }
  const asset = await db.findMarketAsset(ticker);
  if (!asset) return null;
  const window = resolveChartWindow(windowKey, now);
  const limit = Math.min(MARKET_BAR_CAP, window.targetBars);
  let rows = await db.listMarketHistory({
    assetId: asset.id,
    grain: window.grain,
    since: window.start,
    limit,
  });
  if (window.grain === 'month' && rows.length < 3) {
    rows = await db.listMarketHistory({
      assetId: asset.id,
      grain: 'day',
      since: window.start,
      limit: MARKET_BAR_CAP,
    });
  }
  return publicOhlc(asset.ticker, window.key, mapOhlcRows(rows));
}

/**
 * In-process snapshot + OHLC. Page/API reads never stampede Postgres:
 * visitors share one cache, coalesced inflight, last-N OHLC keys.
 * Extra query params (`?_=ts`) never reach the cache key.
 */
export function createMarketCache({
  loadSnapshot,
  loadOhlc,
  ttlMs = MARKET_CACHE_TTL_MS,
  interval = false,
} = {}) {
  let snapshot = { asOf: new Date(0).toISOString(), quotes: [] };
  let snapshotExpires = 0;
  let snapshotInflight = null;
  const ohlc = new Map();
  const ohlcInflight = new Map();
  let timer = null;

  async function pullSnapshot() {
    if (typeof loadSnapshot !== 'function') return;
    try {
      const rows = await loadSnapshot();
      snapshot = publicSnapshot(rows);
    } catch {
      /* keep the last good snapshot */
    }
    snapshotExpires = Date.now() + ttlMs;
    const hot = snapshot.quotes.slice(0, 8);
    for (const quote of hot) {
      getOhlc(quote.ticker, DEFAULT_CHART_WINDOW).catch(() => {});
    }
  }

  function refreshSnapshot() {
    if (Date.now() < snapshotExpires) return snapshotInflight;
    if (snapshotInflight) return snapshotInflight;
    snapshotInflight = pullSnapshot().finally(() => {
      snapshotInflight = null;
    });
    return snapshotInflight;
  }

  function getSnapshot() {
    refreshSnapshot();
    return snapshot;
  }

  async function getOhlc(ticker, windowKey) {
    const symbol = sanitizeTicker(ticker);
    if (!symbol) return null;
    const window = resolveChartWindow(windowKey);
    const key = `${symbol}:${window.key}`;
    const hit = ohlc.get(key);
    if (hit && Date.now() < hit.expires) return hit.payload;
    if (ohlcInflight.has(key)) return ohlcInflight.get(key);
    if (typeof loadOhlc !== 'function') return null;
    const pending = Promise.resolve()
      .then(() => loadOhlc(symbol, window.key))
      .then((payload) => {
        const cleaned = payload ? publicOhlc(payload.ticker, payload.window, payload.bars) : null;
        ohlc.set(key, { expires: Date.now() + ttlMs, payload: cleaned });
        while (ohlc.size > MARKET_OHLC_CACHE_MAX) {
          ohlc.delete(ohlc.keys().next().value);
        }
        return cleaned;
      })
      .finally(() => {
        ohlcInflight.delete(key);
      });
    ohlcInflight.set(key, pending);
    return pending;
  }

  if (interval) {
    refreshSnapshot();
    timer = setInterval(refreshSnapshot, ttlMs);
    timer.unref?.();
  }

  return {
    getSnapshot,
    getOhlc,
    refresh: refreshSnapshot,
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
