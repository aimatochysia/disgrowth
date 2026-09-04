import { html } from '../lib/html.js';
import { CATALOG, formatQty, formatUsd } from '../catalog.js';
import { discordSvg, loginHref, playCta } from './layout.js';

export function homePage({ user, config }) {
  return html`
    <section class="hero">
      <div class="hero-scrim"></div>
      <div class="hero-copy">
        <h1 class="display">
          The city opens<br />
          <em>under the canopy.</em>
        </h1>
        <p class="lede">
          Disgrowth is a Discord game. You run a shop on a shared city market — in Discord, not here. This site is only the real-money store.
        </p>
        <div class="cta-row">
          ${user
            ? html`<a class="btn btn-accent" href="/store">Open the shop</a>`
            : html`<a class="btn btn-accent" href="${loginHref('/store')}">${discordSvg()} Log in with Discord</a>`}
          ${playCta(config)}
        </div>
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">Three wallets. One of them is for sale.</h2>
      <div class="wallet-grid">
        <article class="panel wallet">
          <span class="code">CR</span>
          <h3>Credits</h3>
          <p>The city economy: rent, stock, tax, wages. You earn these by playing.</p>
          <p class="stamp">Cannot be purchased</p>
        </article>
        <article class="panel wallet">
          <span class="code">BN</span>
          <h3>Bonds</h3>
          <p>Daily spend in Discord. Free players get 5 per in-game day. The Accountant pass raises that to 12.</p>
          <p class="stamp">Granted in Discord</p>
        </article>
        <article class="panel wallet wallet-gold">
          <span class="code">GL</span>
          <h3>Gold Bars</h3>
          <p>The premium wallet, sold here. Convert 1 Gold Bar to 1 Bond in Discord with <code>/shop</code> — one way only, never into Credits.</p>
          <p class="stamp">Sold here</p>
        </article>
      </div>
    </section>

    <section class="band">
      <div class="section-head">
        <h2 class="section-title">On the shelf</h2>
        <a class="text-link" href="/store">Full shop →</a>
      </div>
      <div class="sku-grid">
        ${Object.values(CATALOG).map((item) => skuCard(item, { compact: true }))}
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
  const price =
    item.kind === 'subscription'
      ? `${formatUsd(item.usdPlaceholder)} / month`
      : formatUsd(item.usdPlaceholder);
  const grant =
    item.kind === 'subscription' ? 'Monthly' : `${formatQty(item.gold)} Gold Bars`;
  const ctaClass = item.kind === 'subscription' ? 'btn btn-accent' : 'btn btn-gold';
  const ctaLabel = item.kind === 'subscription' ? 'Get the pass' : 'Buy Gold Bars';

  return html`
    <article class="panel sku ${item.kind === 'one_time' ? 'sku-gold' : 'sku-pass'}">
      <div class="sku-meta">
        <span class="kind">${item.kind === 'subscription' ? 'Subscription' : 'One-time'}</span>
      </div>
      <h3>${item.label}</h3>
      <p class="sku-grant">${grant}</p>
      <p>${compact ? item.summary : item.blurb}</p>
      <p class="hint">Delivered to your Discord character.</p>
      <div class="sku-foot">
        <span class="price">${price}</span>
        <a class="${ctaClass}" href="/buy/${item.sku_key}">${ctaLabel}</a>
      </div>
    </article>
  `;
}
