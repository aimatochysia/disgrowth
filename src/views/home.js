import { html } from '../lib/html.js';
import { formatQty } from '../catalog.js';

export function homePage({ config }) {
  return html`
    <section class="hero">
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
      <h2 class="section-title">Start here</h2>
      <div class="beat-grid">
        <article class="panel beat">
          <p class="kicker">01</p>
          <h3>Join Discord</h3>
          <p>The market lives on the server. Come in, then run <code>/disgrowth</code> once so you have a character.</p>
        </article>
        <article class="panel beat">
          <p class="kicker">02</p>
          <h3>Play the season</h3>
          <p>Rent, stock, and sell beside everyone else. Days turn in Discord. This site does not run the clock.</p>
        </article>
        <article class="panel beat">
          <p class="kicker">03</p>
          <h3>Buy when you need it</h3>
          <p>Gold Bars are optional. Convert them in Discord with <code>/shop</code>. Credits are never for sale.</p>
        </article>
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">In the city</h2>
      <div class="beat-grid">
        <article class="panel beat">
          <p class="kicker">Stall</p>
          <h3>Open for the season</h3>
          <p>Take a room, put goods on the shelf, and run the shop next to everyone else in the same market.</p>
        </article>
        <article class="panel beat">
          <p class="kicker">Season</p>
          <h3>One clock for all</h3>
          <p>Days turn in Discord. Bonds arrive with the morning. The city does not wait on this website.</p>
        </article>
        <article class="panel beat">
          <p class="kicker">Purse</p>
          <h3>Gold Bars when you need them</h3>
          <p>Buy a stack here, convert in Discord with <code>/shop</code>. Patron unlocks when lifetime Gold Bars bought reach the tier 1 line.</p>
        </article>
      </div>
    </section>

    <section class="band">
      <div class="section-head">
        <h2 class="section-title">Patron</h2>
        <a class="text-link" href="/store">See packs →</a>
      </div>
      <article class="panel patron-note">
        <p>Patron is not a paid Paddle subscription. If lifetime Gold Bars bought on this Discord account reach 2,600 (the $50 pack, or enough smaller packs), Patron tier 1 turns on: extra daily Bonds in Discord and occasional hints. Hints are imperfect, and may pause if you have been away from the server. Logging into this website doesn’t count. Refunds that drop you below the line turn Patron off.</p>
      </article>
    </section>

    <section class="band">
      <h2 class="section-title">How buying works</h2>
      <ol class="steps">
        <li><strong>Log in with Discord</strong> so the purchase lands on your character.</li>
        <li><strong>Confirm you are 18+</strong> and accept the store terms.</li>
        <li><strong>Pay on checkout.</strong> Paddle opens as a one-page overlay. We never see the card number. First Gold Bar purchase doubles the bars.</li>
        <li><strong>Open <code>/shop</code> in Discord.</strong> Wallets usually update within a few seconds.</li>
      </ol>
    </section>

    <section class="band close-band">
      <h2 class="section-title">Come play</h2>
      <p class="lede narrow">The market is already open. Join the server, run <code>/disgrowth</code>, then pick up Gold Bars when you want a larger stack.</p>
      <div class="cta-row">
        <a class="btn btn-accent" href="${config.DISCORD_COMMUNITY_INVITE}" rel="noopener noreferrer" target="_blank">Join the community</a>
        <a class="btn btn-ghost" href="/store">Shop Gold Bars</a>
      </div>
    </section>
  `;
}

export function skuCard(item, { compact = false } = {}) {
  const grant = `${formatQty(item.gold)} Gold Bars`;
  const priceId = item.priceId || '';
  const perk = item.gold >= 2600 ? 'Unlocks Patron tier 1' : 'One-time';

  return html`
    <article class="panel sku sku-gold">
      <div class="sku-meta">
        <span class="kind">${perk}</span>
      </div>
      <h3>${item.name || item.label}</h3>
      <p class="sku-grant">${grant}</p>
      <p class="sku-blurb">${compact ? item.summary || item.description : item.blurb || item.description}</p>
      <p class="hint">Delivered to your Discord character.</p>
      <div class="sku-foot">
        <span class="price" data-paddle-price-id="${priceId}">…</span>
        <a class="btn btn-gold" href="/buy/${item.sku || item.sku_key}">Buy Gold Bars</a>
      </div>
    </article>
  `;
}
