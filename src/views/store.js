import { html } from '../lib/html.js';
import { skuCard } from './home.js';

export function storePage({ items = [] } = {}) {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Shop</h1>
      <p class="lede narrow">
        Gold Bars for the city. Prices are shown as Paddle totals for your country — the catalog is still $10, $25, $50, and $100.
        Your first Gold Bar purchase doubles the bars (once per Discord account). Patron is unlocked from lifetime Gold Bars bought, not sold as a subscription.
      </p>
    </section>

    <section class="band tight">
      <div class="sku-grid sku-grid-store">
        ${items.map((item) => skuCard(item, { compact: false }))}
      </div>
    </section>
  `;
}
