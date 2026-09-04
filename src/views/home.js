import { html } from '../lib/html.js';
import { CATALOG, formatQty, formatUsd } from '../catalog.js';
import { discordSvg, loginHref, playCta } from './layout.js';

export function homePage({ user, config }) {
  return html`
    <section class="hero">
      <div class="hero-scrim"></div>
      <div class="hero-copy">
        <p class="kicker">— 01  Synopsis</p>
        <h1 class="display">
          The city opens<br />
          <em>under the canopy.</em>
        </h1>
        <p class="lede">
          Disgrowth is a Discord economy game. You rent a room, open a shop, and grow a company on a shared city market — in Discord, not in a browser. Credits (CR) are earned in play and cannot be bought. Bonds (BN) are a daily spend wallet. Gold Bars (GL) are the premium wallet you can buy here. Convert Gold Bars into Bonds in Discord with <code>/shop</code> (1 GL = 1 BN, never the other way, never into Credits). The Accountant pass is a real-money subscription: extra daily Bonds and DM hints. Login with Discord before you pay so the purchase lands on your character.
        </p>
        <div class="cta-row">
          ${user
            ? html`<a class="btn btn-accent" href="/store">Open the store</a>`
            : html`<a class="btn btn-accent" href="${loginHref('/store')}">${discordSvg()} Login with Discord</a>`}
          ${playCta(config)}
        </div>
        <p class="hint">Played in Discord. This is the store.</p>
      </div>
    </section>

    <section class="band">
      <p class="kicker">— 02  Wallets</p>
      <h2 class="section-title">Three ledgers. One of them is for sale.</h2>
      <div class="wallet-grid">
        <article class="panel wallet">
          <span class="code">CR</span>
          <h3>Credits</h3>
          <p>City economy: rent, COGS, tax, wages, filings. Earned in play.</p>
          <p class="stamp">Cannot be purchased</p>
        </article>
        <article class="panel wallet">
          <span class="code">BN</span>
          <h3>Bonds</h3>
          <p>Daily spend. The bot grants 5 per in-game day, or 12 with the Accountant pass. Franchise tools in Discord cost hundreds to thousands of BN.</p>
          <p class="stamp">Daily, granted in Discord</p>
        </article>
        <article class="panel wallet wallet-gold">
          <span class="code">GL</span>
          <h3>Gold Bars</h3>
          <p>Premium wallet. Sold here. Convert 1:1 to Bonds in Discord with <code>/shop</code>. One way only.</p>
          <p class="stamp">Premium · this store</p>
        </article>
      </div>
    </section>

    <section class="band">
      <p class="kicker">— 03  Catalog</p>
      <div class="section-head">
        <h2 class="section-title">What you can buy</h2>
        <a class="text-link" href="/store">Full store →</a>
      </div>
      <div class="sku-grid">
        ${Object.values(CATALOG).map((item) => skuCard(item, { compact: true }))}
      </div>
    </section>

    <section class="band">
      <p class="kicker">— 04  Procedure</p>
      <h2 class="section-title">How checkout works</h2>
      <ol class="steps">
        <li><strong>Discord login.</strong> Identify only. We attach the purchase to your character.</li>
        <li><strong>Confirm 18+.</strong> Terms, virtual items, and no cash value.</li>
        <li><strong>Lemon Squeezy pays.</strong> They are Merchant of Record. We never see your card number.</li>
        <li><strong>Wallets update in Discord.</strong> Open <code>/shop</code>. Usually seconds after payment.</li>
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
    item.kind === 'subscription' ? 'Subscription' : `${formatQty(item.gold)} GL`;
  const ctaClass = item.kind === 'subscription' ? 'btn btn-accent' : 'btn btn-gold';
  const ctaLabel = item.kind === 'subscription' ? 'Subscribe' : 'Buy Gold Bars';

  return html`
    <article class="panel sku ${item.kind === 'one_time' ? 'sku-gold' : 'sku-pass'}">
      <div class="sku-meta">
        <span class="code">${item.ledger}</span>
        <span class="kind">${item.kind === 'subscription' ? 'Monthly' : 'One-time'}</span>
      </div>
      <h3>${item.label}</h3>
      <p class="sku-grant">${grant}</p>
      <p>${compact ? item.summary : item.blurb}</p>
      <div class="sku-foot">
        <span class="price">${price}</span>
        <a class="${ctaClass}" href="/buy/${item.sku_key}">${ctaLabel}</a>
      </div>
    </article>
  `;
}
