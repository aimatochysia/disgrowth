import { html } from '../lib/html.js';
import { CATALOG } from '../catalog.js';
import { skuCard } from './home.js';

export function storePage() {
  return html`
    <section class="page-hero">
      <p class="kicker">— Store</p>
      <h1 class="display display-page">The shop</h1>
      <p class="lede narrow">
        Two Gold Bar packs and one Accountant pass. Credits (CR) are not sold. Conversion of Gold Bars (GL) to Bonds (BN) happens in Discord with <code>/shop</code>, not here.
      </p>
    </section>

    <section class="band tight">
      <div class="sku-grid sku-grid-store">
        ${Object.values(CATALOG).map((item) => skuCard(item, { compact: false }))}
      </div>
    </section>

    <section class="band">
      <div class="panel note">
        <p class="kicker">— Not on this store</p>
        <ul class="plain">
          <li>Credits, extra companies, extra branches, tax cuts, offline cap, equity, board seats.</li>
          <li>Gacha / recruit pulls (currently off in the game).</li>
          <li>Gold Bars → Bonds conversion (Discord <code>/shop</code> only).</li>
        </ul>
        <p class="hint">Franchise tools in Discord cost Bonds: Applicant blitz 1000 BN, Network rescue 1600 BN, CEO sharpness 600 BN, Instant month 400 BN, Extra invest slot 800 BN.</p>
      </div>
    </section>
  `;
}
