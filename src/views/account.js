import { html } from '../lib/html.js';
import { discordAvatarUrl } from '../session.js';

function n(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

export function accountPage({ user, player, dbReady, paddleCustomer = null, portalError = '' }) {
  if (!dbReady) {
    return html`
      <section class="page-hero">
        <h1 class="display display-page">${user.globalName || user.username}</h1>
        <p class="lede narrow">You’re logged in. Wallets will show here once the store is connected to the game.</p>
      </section>
    `;
  }

  if (!player) {
    return html`
      <section class="page-hero">
        <h1 class="display display-page">${user.globalName || user.username}</h1>
        <p class="lede narrow">No Disgrowth character on this Discord account yet. Run <code>/disgrowth</code> in Discord, then refresh. You can’t check out until that exists.</p>
      </section>
    `;
  }

  const onboarding = player.onboarding_step;
  const needsTutorial = onboarding && onboarding !== 'complete' && onboarding !== 'raise_stats';

  return html`
    <section class="page-hero account-hero">
      <img class="avatar" src="${discordAvatarUrl(user.discordId, user.avatar)}" alt="" width="64" height="64" />
      <div>
        <h1 class="display display-page">${user.globalName || user.username}</h1>
        <p class="hint">Discord character</p>
      </div>
    </section>

    ${needsTutorial
      ? html`<p class="flash">Finish the tutorial in Discord. Daily Bonds wait until that’s done.</p>`
      : ''}

    ${portalError ? html`<p class="flash" role="alert">${portalError}</p>` : ''}

    <section class="band tight">
      <div class="wallet-grid">
        <article class="panel wallet">
          <span class="code">CR</span>
          <h3>Credits</h3>
          <p class="balance">${n(player.credits)}</p>
          <p class="stamp">Cannot be purchased</p>
        </article>
        <article class="panel wallet">
          <span class="code">BN</span>
          <h3>Bonds</h3>
          <p class="balance">${n(player.bonds)}</p>
          <p class="stamp">Claimed in Discord</p>
        </article>
        <article class="panel wallet wallet-gold">
          <span class="code">GL</span>
          <h3>Gold Bars</h3>
          <p class="balance">${n(player.gold_bars)}</p>
          <p class="stamp">Convert with /shop</p>
        </article>
      </div>

      <article class="panel">
        <p class="kicker">Store</p>
        <p>Packs are Gold Bars. The first Gold Bar purchase on this Discord account also grants matching Bonds, once.</p>
        <a class="btn btn-gold" href="/store">Shop Gold Bars</a>
      </article>

      <article class="panel">
        <p class="kicker">Receipts</p>
        <p>Invoices and receipts live in the Paddle customer portal.</p>
        ${paddleCustomer
          ? html`<form method="post" action="/account/portal"><button class="btn btn-ghost" type="submit">View invoices</button></form>`
          : html`<p class="hint">After your first purchase, this button appears so you can open past invoices.</p>`}
      </article>
    </section>
  `;
}
