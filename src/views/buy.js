import { html } from '../lib/html.js';
import { formatQty } from '../catalog.js';
import { discordAvatarUrl } from '../session.js';

export function buyPage({ sku, user, player, inviteUrl, error = '', checkoutReady, overlayReady, firstPurchaseAvailable = false }) {
  const name = user.globalName || user.username;

  if (!player) {
    return html`
      <section class="page-hero">
        <h1 class="display display-page">Create your character first</h1>
        <p class="lede narrow">
          You’re logged in as <strong>${name}</strong>, but this Discord account has no Disgrowth character yet. Run <code>/disgrowth</code> in Discord, then refresh this page.
        </p>
        <a class="btn btn-accent" href="${inviteUrl}" rel="noopener noreferrer" target="_blank">Open the Discord server</a>
      </section>
    `;
  }

  const notice = error || (checkoutReady ? '' : 'Purchases aren’t open yet. Check back soon.');

  return html`
    <section class="page-hero">
      <h1 class="display display-page">${sku.label}</h1>
    </section>

    <section class="band tight">
      ${notice ? html`<p class="flash" role="${error ? 'alert' : 'status'}">${notice}</p>` : ''}

      <div class="panel buying-for">
        <img class="avatar" src="${discordAvatarUrl(user.discordId, user.avatar)}" alt="" width="48" height="48" />
        <div>
          <p class="stamp">Buying for</p>
          <p class="buying-name">${name} <span class="code">@${user.username}</span></p>
          <p class="buying-wallet">CR ${formatQty(player.credits)} · BN ${formatQty(player.bonds)} · GL ${formatQty(player.gold_bars)}</p>
          <form method="post" action="/logout"><button class="btn btn-ghost" type="submit">Not you? Log out</button></form>
        </div>
      </div>

      <form
        class="panel buy-form"
        method="post"
        action="/buy/${sku.sku_key}"
        data-buy-form
        data-price-id="${sku.priceId}"
        data-sku="${sku.sku_key}"
        ${overlayReady ? 'data-paddle-overlay' : ''}
      >
        <dl class="facts">
          <div><dt>Price</dt><dd><span data-paddle-price-id="${sku.priceId}">…</span></dd></div>
          ${firstPurchaseAvailable
            ? html`<div><dt>First purchase</dt><dd>+${formatQty(sku.gold)} Bonds</dd></div>`
            : ''}
        </dl>
        <label class="check">
          <input type="checkbox" name="age" value="yes" required />
          <span>I am 18 or the age of majority in my country.</span>
        </label>
        <label class="check">
          <input type="checkbox" name="terms" value="yes" required />
          <span>I agree to the <a href="/legal#terms">Terms of Service</a>, <a href="/legal#virtual-items">Virtual Items Policy</a>, and <a href="/legal#refunds">Refund Policy</a>. I want my items delivered now and understand I may lose my cooling-off withdrawal right.</span>
        </label>
        <label class="check">
          <input type="checkbox" name="novalue" value="yes" required />
          <span>I understand Gold Bars and Bonds have no cash value and cannot be sold for money.</span>
        </label>
        <button class="btn btn-gold" type="submit" ${checkoutReady ? '' : 'disabled'}>Continue to payment</button>
      </form>
    </section>
  `;
}
