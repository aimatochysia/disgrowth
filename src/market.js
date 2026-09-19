import { sanitizeTicker } from './ticker.js';

export const MARKET_CACHE_TTL_MS = 15_000;
export const MARKET_OHLC_CACHE_MAX = 32;
export const MARKET_BAR_CAP = 300;

export const CHART_WINDOWS = {
  '6h': { key: '6h', label: '6 Hours', realMs: 6 * 60 * 60 * 1000, targetCandles: 72, grain: 'tick' },
  '24h': { key: '24h', label: '24 Hours', realMs: 24 * 60 * 60 * 1000, targetCandles: 96, grain: 'tick' },
  '7d': { key: '7d', label: '7 Days', realMs: 7 * 24 * 60 * 60 * 1000, targetCandles: 84, grain: 'day' },
};

export function resolveChartWindow(windowKey, now = new Date()) {
  const key = CHART_WINDOWS[windowKey] ? windowKey : '24h';
  const window = CHART_WINDOWS[key];
  const end = now instanceof Date ? now : new Date(now);
  const start = new Date(end.getTime() - window.realMs);
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
  return ((now - open) / open * 100).toFixed(2);
}

function round4(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
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
  const v = round4(row?.v) ?? 0;
  if (!Number.isFinite(t) || o == null || h == null || l == null || c == null) return null;
  return { t, o, h, l, c, v };
}

export function publicOhlc(ticker, windowKey, bars) {
  const symbol = sanitizeTicker(ticker);
  const window = CHART_WINDOWS[windowKey] ? windowKey : '24h';
  const cleaned = [];
  for (const row of bars || []) {
    const bar = publicBar(row);
    if (bar) cleaned.push(bar);
    if (cleaned.length >= MARKET_BAR_CAP) break;
  }
  return { ticker: symbol, window, bars: cleaned };
}

function priceOf(row) {
  const close = Number(row.close);
  if (Number.isFinite(close)) return close;
  const price = Number(row.price);
  return Number.isFinite(price) ? price : null;
}

export function mapOhlcRows(rows) {
  const bars = [];
  for (const row of rows || []) {
    const at = row.period_start || row.recorded_at;
    const t = Math.floor(new Date(at).getTime() / 1000);
    const price = priceOf(row);
    const bar = publicBar({
      t,
      o: row.open ?? price,
      h: row.high ?? price,
      l: row.low ?? price,
      c: row.close ?? price,
      v: row.volume || 0,
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
    volume: 0,
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
      bucket.high = Math.max(bucket.high, Number(row.high) || price);
      bucket.low = Math.min(bucket.low, Number(row.low) || price);
    }
    bucket.close = price;
    bucket.volume += Math.abs(Number(row.volume) || 0);
    bucket.samples += 1;
  }

  const bars = [];
  for (const bucket of buckets) {
    if (bucket.samples === 0) continue;
    const bar = publicBar({
      t: Math.floor(bucket.start / 1000),
      o: bucket.open,
      h: bucket.high,
      l: bucket.low,
      c: bucket.close,
      v: bucket.volume,
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
  let rows = await db.listMarketHistory({
    assetId: asset.id,
    grain: window.grain,
    since: window.start,
    limit: window.grain === 'day' ? MARKET_BAR_CAP : 2000,
  });
  let bars;
  if (window.grain === 'day' && rows.length) {
    bars = mapOhlcRows(rows);
  } else {
    if (window.grain === 'day' && !rows.length) {
      rows = await db.listMarketHistory({
        assetId: asset.id,
        grain: 'tick',
        since: window.start,
        limit: 2000,
      });
    }
    bars = bucketBars(rows, window.start, window.end, window.targetCandles);
  }
  return publicOhlc(asset.ticker, window.key, bars);
}

/**
 * In-process snapshot + OHLC. Page/API reads never stampede Postgres:
 * visitors share one cache, coalesced inflight, last-N OHLC keys.
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
      getOhlc(quote.ticker, '24h').catch(() => {});
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
        if (!payload) return null;
        const cleaned = publicOhlc(payload.ticker, payload.window, payload.bars);
        ohlc.set(key, { expires: Date.now() + ttlMs, payload: cleaned });
        if (ohlc.size > MARKET_OHLC_CACHE_MAX) {
          const oldest = ohlc.keys().next().value;
          ohlc.delete(oldest);
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
