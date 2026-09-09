import { html } from './lib/html.js';

export const TICKER_TTL_MS = 30_000;
export const TICKER_COPIES = 4;

const TICKER_RE = /^[A-Z0-9]{1,8}$/;

export const FALLBACK_TICKER = [
  { kind: 'label', text: 'DISGROWTH' },
  { kind: 'label', text: 'CITY MARKET' },
  { kind: 'label', text: 'GOLD BARS' },
  { kind: 'label', text: 'PLAYED IN DISCORD' },
];

export function sanitizeTicker(value) {
  const ticker = String(value || '')
    .trim()
    .toUpperCase();
  return TICKER_RE.test(ticker) ? ticker : '';
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2);
}

export function formatQuote(row) {
  const ticker = sanitizeTicker(row?.ticker);
  if (!ticker) return null;
  const price = money(row.price);
  if (!price) return null;
  const prev = Number(row.prev_price);
  const now = Number(row.price);
  let dir = 'flat';
  let change = '';
  if (Number.isFinite(prev) && prev > 0 && Number.isFinite(now)) {
    const pct = ((now - prev) / prev) * 100;
    if (pct > 0.005) dir = 'up';
    else if (pct < -0.005) dir = 'down';
    const abs = Math.abs(pct).toFixed(2);
    change = `${pct >= 0 ? '+' : '−'}${abs}%`;
  }
  return { kind: 'quote', ticker, price, change, dir };
}

export function quotesFromRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return FALLBACK_TICKER;
  const quotes = [];
  for (const row of rows) {
    const quote = formatQuote(row);
    if (quote) quotes.push(quote);
  }
  return quotes.length ? quotes : FALLBACK_TICKER;
}

export function tickerUnit(quotes) {
  const items = quotes?.length ? quotes : FALLBACK_TICKER;
  return items.map((item) => {
    if (item.kind === 'quote') {
      return html`<span class="sym">${item.ticker}</span><span class="px ${item.dir}">${item.price}${item.change ? ` ${item.change}` : ''}</span><span class="dot">◆</span>`;
    }
    return html`<span>${item.text}</span><span class="dot">◆</span>`;
  });
}

export function tickerTrack(quotes) {
  const unit = tickerUnit(quotes);
  return Array.from({ length: TICKER_COPIES }, () => unit);
}

/**
 * In-process snapshot. Page renders never wait on Postgres: visitors share one
 * cached strip, refreshed on a timer (or the first request after TTL).
 */
export function createQuoteCache({ load, ttlMs = TICKER_TTL_MS, interval = false } = {}) {
  let quotes = FALLBACK_TICKER;
  let expires = 0;
  let inflight = null;
  let timer = null;

  async function pull() {
    if (typeof load !== 'function') return;
    try {
      const rows = await load();
      quotes = quotesFromRows(rows);
    } catch {
      /* keep the last good strip */
    }
    expires = Date.now() + ttlMs;
  }

  function refresh() {
    if (Date.now() < expires) return inflight;
    if (inflight) return inflight;
    inflight = pull().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function snapshot() {
    refresh();
    return quotes;
  }

  if (interval) {
    refresh();
    timer = setInterval(refresh, ttlMs);
    timer.unref?.();
  }

  return {
    snapshot,
    refresh,
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
