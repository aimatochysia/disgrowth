import { html } from '../lib/html.js';
import { CHART_WINDOW_KEYS, DEFAULT_CHART_WINDOW } from '../market.js';

export const COMMODITY_NOTES = {
  CHEM: 'Cleaners, fertiliser and the upkeep every shop needs.',
  COMP: 'Advanced parts: chips, boards and robotics.',
  FUEL: 'What the city burns to move and to make things.',
  MACH: 'Low machinery: presses, pumps and tools.',
  METL: 'Raw resources: ore, steel and wire.',
  PRDC: 'Produce: what the city eats.',
  RECL: 'Recyclables. Tends to climb when the rest of the market falls.',
  TXTL: 'Textiles: cloth, thread and finished fabric.',
};

function changeClass(changePct) {
  const n = Number(changePct);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function formatChange(changePct) {
  const n = Number(changePct);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n).toFixed(2);
  return `${n >= 0 ? '+' : '−'}${abs}%`;
}

function quoteRow(quote, selected) {
  const on = quote.ticker === selected ? ' is-on' : '';
  const note = quote.type === 'commodity' ? COMMODITY_NOTES[quote.ticker] || '' : quote.mix || '';
  const mixClass = note ? ' has-mix' : '';
  const href = `/market?ticker=${encodeURIComponent(quote.ticker)}`;
  const mix = note ? html`<span class="quote-mix">${note}</span>` : '';
  return html`<a class="quote-row${on}${mixClass}" href="${href}" data-ticker="${quote.ticker}">
    <span class="quote-sym">${quote.ticker}</span>
    <span class="quote-name">${quote.name}${mix}</span>
    <span class="quote-px">${quote.price}</span>
    <span class="quote-chg ${changeClass(quote.changePct)}">${formatChange(quote.changePct)}</span>
  </a>`;
}

function quoteList(title, quotes, selected) {
  if (!quotes.length) {
    return html`<div class="quote-list">
      <h2 class="quote-heading">${title}</h2>
      <p class="muted">None listed.</p>
    </div>`;
  }
  return html`<div class="quote-list">
    <h2 class="quote-heading">${title}</h2>
    <div class="quote-rows">${quotes.map((quote) => quoteRow(quote, selected))}</div>
  </div>`;
}

export function marketPage({ quotes = [], ticker = '', windowKey = DEFAULT_CHART_WINDOW } = {}) {
  const commodities = quotes.filter((quote) => quote.type === 'commodity');
  const companies = quotes.filter((quote) => quote.type === 'company');
  const focus = quotes.find((quote) => quote.ticker === ticker);
  const tickerQ = ticker ? encodeURIComponent(ticker) : '';
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Market</h1>
      <p class="lede narrow">Prices from the city market. Trading happens in Discord.</p>
    </section>
    <section class="market-board panel">
      <div class="market-lists">
        ${quoteList('Commodities', commodities, ticker)}
        ${quoteList('Companies', companies, ticker)}
      </div>
      <div class="market-chart-pane">
        <div class="market-chart-head">
          <p class="kicker" id="market-focus">${ticker || '—'}</p>
          ${focus?.mix ? html`<p class="market-mix" id="market-mix">${focus.mix}</p>` : ''}
          <div class="market-windows" role="group" aria-label="Chart range">
            ${CHART_WINDOW_KEYS.map((key) => {
              const href = tickerQ
                ? `/market?ticker=${tickerQ}&window=${key}`
                : `/market?window=${key}`;
              return html`<a class="market-window${key === windowKey ? ' is-on' : ''}" href="${href}" data-window="${key}">${key}</a>`;
            })}
            <button type="button" class="market-window market-reset" data-reset>Reset</button>
          </div>
        </div>
        <div class="market-chart-canvas" id="market-chart" role="img" aria-label="Price chart"></div>
      </div>
    </section>
  `;
}
