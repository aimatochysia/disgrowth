import { html } from '../lib/html.js';
import { CHART_WINDOW_KEYS, DEFAULT_CHART_WINDOW } from '../market.js';

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
  const href = `/market?ticker=${encodeURIComponent(quote.ticker)}`;
  return html`<a class="quote-row${on}" href="${href}" data-ticker="${quote.ticker}">
    <span class="quote-sym">${quote.ticker}</span>
    <span class="quote-name">${quote.name}</span>
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
