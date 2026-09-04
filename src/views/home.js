import { html } from '../lib/html.js';
import { formatQty, formatUsd } from '../catalog.js';

export function homePage({ config }) {
  return html`
    <section class="hero">
      <div class="hero-scrim"></div>
      <div class="hero-copy">
        <h1 class="display">
          The city opens<br />
          <em>under the canopy.</em>
        </h1>
        <p class="lede">
          Rent a stall, stock the shelves, and grow a company on a shared city market. Everyone plays in the same season.
        </p>
        <div class="cta-row">
          <a class="btn btn-accent" href="${config.DISCORD_COMMUNITY_INVITE}" rel="noopener noreferrer" target="_blank">Join the community</a>
          <a class="btn btn-ghost" href="/store">Shop Gold Bars</a>
        </div>
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">How buying works</h2>
      <ol class="steps">
        <li><strong>Log in with Discord</strong> so the purchase lands on your character.</li>
        <li><strong>Confirm you are 18+</strong> and accept the store terms.</li>
        <li><strong>Pay on checkout.</strong> Lemon Squeezy handles the card. We never see the number.</li>
        <li><strong>Open <code>/shop</code> in Discord.</strong> Wallets usually update within a few seconds.</li>
      </ol>
    </section>
  `;
}

export function skuCard(item, { compact = false } = {}) {
  const price = formatUsd(item.usdPlaceholder);
  const grant = `${formatQty(item.gold)} Gold Bars`;
  const perk = item.patronDays
    ? `Includes ${item.patronDays} days of Patron`
    : 'One-time';

  return html`
    <article class="panel sku sku-gold">
      <div class="sku-meta">
        <span class="kind">${perk}</span>
      </div>
      <h3>${item.label}</h3>
      <p class="sku-grant">${grant}</p>
      <p class="sku-blurb">${compact ? item.summary : item.blurb}</p>
      <p class="hint">Delivered to your Discord character.</p>
      <div class="sku-foot">
        <span class="price">${price}</span>
        <a class="btn btn-gold" href="/buy/${item.sku_key}">Buy Gold Bars</a>
      </div>
    </article>
  `;
}
