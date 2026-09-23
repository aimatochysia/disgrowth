import { html } from '../lib/html.js';

function skuCard(item) {
  return html`
    <article class="panel sku">
      <h2 class="sku-title">${item.label}</h2>
      <p class="sku-blurb">${item.blurb}</p>
      <div class="sku-foot">
        <span class="price" data-paddle-price-id="${item.priceId}">…</span>
        <a class="btn btn-gold" href="/buy/${item.sku}" aria-label="Buy ${item.label}">Buy</a>
      </div>
    </article>
  `;
}

export function storePage({ items = [] } = {}) {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Shop</h1>
      <p class="lede narrow">
        Gold Bars convert 1:1 to Bonds with <code>/shop</code> in Discord. Your first purchase adds the same number of Bonds as Gold Bars, once per Discord account.
      </p>
    </section>

    <section class="band tight">
      <div class="sku-grid">
        ${items.map(skuCard)}
      </div>
      <p class="hint">Prices include tax for your country.</p>
    </section>
  `;
}
