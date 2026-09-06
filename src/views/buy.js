import { html } from '../lib/html.js';
import { formatQty, formatUsd } from '../catalog.js';

export function buyPage({ sku, user, player, error, checkoutReady, firstPurchaseAvailable = false }) {
  const price = formatUsd(sku.usdPlaceholder);
  const grantGold = firstPurchaseAvailable ? sku.gold * 2 : sku.gold;
  const grant = sku.patronDays
    ? `${formatQty(grantGold)} Gold Bars + ${sku.patronDays} days of Patron`
    : `${formatQty(grantGold)} Gold Bars`;

  if (!player) {
    return html`
      <section class="page-hero">
        <h1 class="display display-page">Play once in Discord first</h1>
        <p class="lede narrow">
          You’re logged in as <strong>${user.globalName || user.username}</strong>, but this Discord account doesn’t have a Disgrowth character yet. In your server, run <code>/disgrowth</code>, then come back and refresh.
        </p>
      </section>
    `;
  }

  return html`
    <section class="page-hero">
      <h1 class="display display-page">${sku.label}</h1>
    </section>

    <section class="band tight">
      <div class="panel buy-summary">
        <dl class="facts">
          <div><dt>Item</dt><dd>${sku.label}</dd></div>
          <div><dt>You get</dt><dd>${grant}</dd></div>
          <div><dt>Price</dt><dd>${price}</dd></div>
          <div><dt>Character</dt><dd>${user.globalName || user.username}</dd></div>
        </dl>
        <p>${sku.blurb}</p>
        ${firstPurchaseAvailable
          ? html`<p class="hint">First Gold Bar purchase on this Discord account: you get double the listed Gold Bars this time. Patron days are not doubled. Later purchases are the listed amount.</p>`
          : ''}
        <p class="hint">
          These are virtual items with no cash value.
          <a href="/legal#virtual-items">Virtual items</a> ·
          <a href="/legal#terms">Terms</a> ·
          <a href="/legal#refunds">Refunds</a>
        </p>
      </div>

      ${error ? html`<p class="flash" role="alert">${error}</p>` : ''}

      ${!checkoutReady
        ? html`<p class="flash" role="status">Purchases aren’t open yet. Check back soon.</p>`
        : ''}

      <form class="panel buy-form" method="post" action="/buy/${sku.sku_key}" data-buy-form>
        <label class="check">
          <input type="checkbox" name="age" value="yes" required />
          <span>I am 18 or the age of majority in my country.</span>
        </label>
        <label class="check">
          <input type="checkbox" name="terms" value="yes" required />
          <span>I agree to the <a href="/legal#terms">Terms of Service</a> and <a href="/legal#virtual-items">Virtual Items Policy</a>. I want digital items delivered now, and I understand that means I may lose a cooling-off withdrawal right.</span>
        </label>
        <label class="check">
          <input type="checkbox" name="novalue" value="yes" required />
          <span>I understand Gold Bars and Patron have no cash value and cannot be sold for money.</span>
        </label>
        <button class="btn btn-gold" type="submit" ${checkoutReady ? '' : 'disabled'}>
          Continue to checkout
        </button>
      </form>
    </section>
  `;
}
