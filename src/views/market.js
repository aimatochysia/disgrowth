import { html } from '../lib/html.js';
import { CHART_WINDOW_KEYS, DEFAULT_CHART_WINDOW } from '../market.js';

export const COMMODITY_NOTES = {
  PHRM: 'Cleaners, fertiliser and the upkeep every shop needs.',
  COMP: 'Advanced parts: chips, boards and robotics.',
  FUEL: 'What the city burns to move and to make things.',
  MACH: 'Low machinery: presses, pumps and tools.',
  METL: 'Raw resources: ore, steel and wire.',
  PRDC: 'Produce: what the city eats.',
  RECL: 'Recyclables. Tends to climb when the rest of the market falls.',
  TXTL: 'Textiles: cloth, thread and finished fabric.',
};

export const PAGE_SIZE = 50;

const SORTS = [
  ['cap', 'Market cap'],
  ['change', 'Change'],
  ['price', 'Price'],
  ['volume', 'Volume'],
  ['ticker', 'Ticker'],
];

// The first paint; public/js/market.js takes over the list, filters and heatmap.
function changeClass(change) {
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function formatChange(change) {
  const n = Number(change);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;
}

function quoteRow(quote, selected, windowKey) {
  const on = quote.ticker === selected ? ' is-on' : '';
  const change = quote.changes?.[windowKey === '5Y' || windowKey === 'ALL' ? '1Y' : windowKey];
  const sub = quote.focus || quote.sector || '';
  const href = `/market?ticker=${encodeURIComponent(quote.ticker)}`;
  return html`<a class="quote-row${on}" href="${href}" data-ticker="${quote.ticker}">
    <span class="quote-sym">${quote.ticker}</span>
    <span class="quote-name">${quote.name}${sub ? html`<span class="quote-mix">${sub}</span>` : ''}</span>
    <span class="quote-px">${quote.price}</span>
    <span class="quote-chg ${changeClass(change)}">${formatChange(change)}</span>
  </a>`;
}

export function marketPage({ quotes = [], ticker = '', windowKey = DEFAULT_CHART_WINDOW } = {}) {
  const focus = quotes.find((quote) => quote.ticker === ticker);
  const tickerQ = ticker ? encodeURIComponent(ticker) : '';
  const sectors = [...new Set(quotes.map((quote) => quote.sector).filter(Boolean))].sort();
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Market</h1>
      <p class="lede narrow">Prices from the city market. Trading happens in Discord.</p>
    </section>
    <section class="market-screen panel">
      <div class="market-toolbar">
        <input class="market-search" id="market-search" type="search" placeholder="Search ticker, name or focus ( / )" autocomplete="off" aria-label="Search the market" />
        <select id="market-type" aria-label="Type">
          <option value="">All types</option>
          <option value="commodity">Commodities</option>
          <option value="company">Companies</option>
        </select>
        <select id="market-sector" aria-label="Sector">
          <option value="">All sectors</option>
          ${sectors.map((sector) => html`<option value="${sector}">${sector}</option>`)}
        </select>
        <select id="market-sort" aria-label="Sort by">
          ${SORTS.map(([key, label]) => html`<option value="${key}">${label}</option>`)}
        </select>
        <div class="market-windows" role="group" aria-label="Window">
          ${CHART_WINDOW_KEYS.map((key) => {
            const href = tickerQ
              ? `/market?ticker=${tickerQ}&window=${key}`
              : `/market?window=${key}`;
            return html`<a class="market-window${key === windowKey ? ' is-on' : ''}" href="${href}" data-window="${key}">${key}</a>`;
          })}
        </div>
      </div>
      <div class="market-heatmap" id="market-heatmap" aria-label="Market heatmap"></div>
      <div class="market-board">
        <div class="market-lists">
          <div class="quote-rows" id="market-rows">
            ${quotes.slice(0, PAGE_SIZE).map((quote) => quoteRow(quote, ticker, windowKey))}
          </div>
          <p class="muted" id="market-empty" hidden>Nothing matches.</p>
          <div class="market-pager" id="market-pager" hidden>
            <button type="button" class="market-window" data-page="-1">Prev</button>
            <span class="muted" id="market-page"></span>
            <button type="button" class="market-window" data-page="1">Next</button>
          </div>
        </div>
        <div class="market-chart-pane">
          <div class="market-chart-head">
            <div>
              <p class="kicker" id="market-focus">${ticker || '—'}</p>
              <p class="market-mix" id="market-sub">${focus?.focus || ''}</p>
            </div>
            <div class="market-windows" role="group" aria-label="Indicators">
              <button type="button" class="market-window" data-ind="sma20">SMA 20</button>
              <button type="button" class="market-window" data-ind="ema20">EMA 20</button>
              <button type="button" class="market-window" data-ind="ema50">EMA 50</button>
              <button type="button" class="market-window market-reset" data-reset>Reset</button>
            </div>
          </div>
          <div class="market-chart-canvas" id="market-chart" role="img" aria-label="Price chart"></div>
        </div>
      </div>
    </section>
  `;
}
