import { html } from '../lib/html.js';
import { formatQty, formatUsd } from '../catalog.js';

export function buyPage({ sku, user, player, error, checkoutReady }) {
  const price =
    sku.kind === 'subscription'
      ? `${formatUsd(sku.usdPlaceholder)} / month`
      : formatUsd(sku.usdPlaceholder);
  const grant =
    sku.kind === 'subscription'
      ? 'Accountant pass (extra daily Bonds and occasional DM hints)'
      : `${formatQty(sku.gold)} Gold Bars`;

  if (!player) {
    return html`
      <section class="page-hero">
        <p class="kicker">— Checkout held</p>
        <h1 class="display display-page">Run /disgrowth first</h1>
        <p class="lede narrow">
          You are logged in as <strong>${user.globalName || user.username}</strong>, but there is no player row yet. Open Discord, run <code>/disgrowth</code>, then refresh this page. We will not start checkout and we will not create a half-formed character.
        </p>
        <p class="hint">Logged in · no game account</p>
      </section>
    `;
  }

  return html`
    <section class="page-hero">
      <p class="kicker">— Confirm purchase</p>
      <h1 class="display display-page">${sku.label}</h1>
    </section>

    <section class="band tight">
      <div class="panel buy-summary">
        <dl class="facts">
          <div><dt>Item</dt><dd>${sku.label}</dd></div>
          <div><dt>Grant</dt><dd>${grant}</dd></div>
          <div><dt>Price</dt><dd>${price} <span class="muted">(placeholder)</span></dd></div>
          <div><dt>Character</dt><dd>${user.globalName || user.username} · ${user.discordId}</dd></div>
        </dl>
        <p>${sku.blurb}</p>
        <p class="hint">
          Virtual items have no cash value and cannot be sold for money.
          See <a href="/legal/virtual-items">Virtual items</a>,
          <a href="/legal/terms">Terms</a>, and
          <a href="/legal/refunds">Refunds</a>.
        </p>
      </div>

      ${error ? html`<p class="flash" role="alert">${error}</p>` : ''}

      ${!checkoutReady
        ? html`<p class="flash" role="status">Checkout is not configured in this environment. The operator still needs Lemon Squeezy variant ids.</p>`
        : ''}

      <form class="panel buy-form" method="post" action="/buy/${sku.sku_key}" data-buy-form>
        <label class="check">
          <input type="checkbox" name="age" value="yes" required />
          <span>I am 18 or the age of majority in my country.</span>
        </label>
        <label class="check">
          <input type="checkbox" name="terms" value="yes" required />
          <span>I agree to the <a href="/legal/terms">Terms of Service</a> and <a href="/legal/virtual-items">Virtual Items Policy</a>. I consent to immediate delivery of digital content and acknowledge that I lose any withdrawal right that depends on that consent.</span>
        </label>
        <label class="check">
          <input type="checkbox" name="novalue" value="yes" required />
          <span>I understand Gold Bars and the pass have no cash value and cannot be sold for money.</span>
        </label>
        <button class="${sku.kind === 'subscription' ? 'btn btn-accent' : 'btn btn-gold'}" type="submit" ${checkoutReady ? '' : 'disabled'}>
          Continue to Lemon Squeezy
        </button>
      </form>
    </section>
  `;
}
