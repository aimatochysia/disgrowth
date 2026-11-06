import { html } from '../lib/html.js';
import { CHART_WINDOW_KEYS, DEFAULT_CHART_WINDOW } from '../market.js';

export const COMMODITY_NOTES = {
  AGRI: 'Agriculture: crops, seeds, berries, flour and meals.',
  ALCM: 'Alchemy: herbs, tea and salve.',
  BMAT: 'Basic materials: logs, stone, iron ore and wild fibre.',
  BMON: 'Basic monster drops: hide, bone and slime.',
  COMP: 'Components: planks, ingots, nails, rope and cloth.',
  FUEL: 'Charcoal and firewood.',
  TXTL: 'Textiles: cloth goods and clothes.',
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

function windowLinks(base, tickerQ, windowKey) {
  return CHART_WINDOW_KEYS.map((key) => {
    const href = tickerQ ? `${base}?ticker=${tickerQ}&window=${key}` : `${base}?window=${key}`;
    return html`<a class="market-window${key === windowKey ? ' is-on' : ''}" href="${href}" data-window="${key}">${key}</a>`;
  });
}

// Formulas are typed here and run in the browser only (public/js/market-formula.js); nothing is posted.
function chartPane({ ticker, focus, solo = false }) {
  return html`<div class="market-chart-pane">
    <div class="market-chart-head">
      <div>
        <p class="kicker" id="market-focus">${ticker || '—'}</p>
        <p class="market-mix" id="market-sub">${focus?.focus || ''}</p>
      </div>
      ${solo || !ticker ? '' : html`<a class="market-window" href="/market/${ticker}">Full page</a>`}
    </div>
    <div class="market-chart-canvas${solo ? ' is-tall' : ''}" id="market-chart" role="img" aria-label="Price chart"></div>
    <form class="market-formula" id="market-formula-form" autocomplete="off">
      <input class="market-search" id="market-formula" type="text" maxlength="120" placeholder="Add a line: sma(close, 20), ema(close, 12) - ema(close, 26)" aria-label="Chart formula" />
      <button type="submit" class="market-window">Add</button>
    </form>
    <p class="muted" id="market-formula-note" role="status"></p>
    <div class="market-formulas" id="market-formulas"></div>
    <p class="hint">Lines use close with sma, ema, hi, lo and abs. They stay in this browser and are never sent anywhere.</p>
  </div>`;
}

export function tickerPage({ quote, windowKey = DEFAULT_CHART_WINDOW } = {}) {
  const change = quote.changes?.[windowKey === '5Y' || windowKey === 'ALL' ? '1Y' : windowKey];
  return html`
    <section class="page-hero">
      <p class="kicker"><a href="/market">← Market</a></p>
      <h1 class="display display-page">${quote.name} <span class="muted">${quote.ticker}</span></h1>
      <p class="lede narrow">${quote.price} CR${change != null ? html` <span class="quote-chg ${changeClass(change)}">${formatChange(change)}</span>` : ''}${quote.focus ? html` · ${quote.focus}` : ''}</p>
    </section>
    <section class="market-screen panel">
      <div class="market-windows market-solo-windows" role="group" aria-label="Window">
        ${windowLinks(`/market/${quote.ticker}`, '', windowKey)}
      </div>
      ${chartPane({ ticker: quote.ticker, focus: quote, solo: true })}
    </section>
  `;
}

export function marketPage({ quotes = [], ticker = '', windowKey = DEFAULT_CHART_WINDOW } = {}) {
  const focus = quotes.find((quote) => quote.ticker === ticker);
  const tickerQ = ticker ? encodeURIComponent(ticker) : '';
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Market</h1>
      <p class="lede narrow">Prices from the city market. Players never move them, but they set what your goods sell for in Discord. Company stocks are for watching only.</p>
    </section>
    <section class="market-screen panel">
      <div class="market-toolbar">
        <input class="market-search" id="market-search" type="search" placeholder="Search ticker, name or focus ( / )" autocomplete="off" aria-label="Search the market" />
        <select id="market-type" aria-label="Type">
          <option value="">All types</option>
          <option value="commodity">Commodities</option>
          <option value="company">Companies</option>
        </select>
        <select id="market-tag" aria-label="Focus">
          <option value="">All focus</option>
        </select>
        <button type="button" class="market-chip" id="market-chip" aria-label="Clear the focus filter" hidden></button>
        <select id="market-sort" aria-label="Sort by">
          ${SORTS.map(([key, label]) => html`<option value="${key}">${label}</option>`)}
        </select>
        <div class="market-windows" role="group" aria-label="Window">
          ${windowLinks('/market', tickerQ, windowKey)}
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
        ${chartPane({ ticker, focus })}
      </div>
    </section>
  `;
}
