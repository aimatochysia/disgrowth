import { html } from '../lib/html.js';
import { CATALOG } from '../catalog.js';
import { skuCard } from './home.js';

export function storePage() {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Shop</h1>
      <p class="lede narrow">
        Gold Bars for the city. Larger packs include Patron — extra daily Bonds and occasional hints in Discord.
      </p>
    </section>

    <section class="band tight">
      <div class="sku-grid sku-grid-store">
        ${Object.values(CATALOG).map((item) => skuCard(item, { compact: false }))}
      </div>
    </section>
  `;
}
