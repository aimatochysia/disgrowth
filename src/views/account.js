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

  const passOn = Boolean(player.subscription_active);
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
          <p class="stamp">Granted in Discord</p>
        </article>
        <article class="panel wallet wallet-gold">
          <span class="code">GL</span>
          <h3>Gold Bars</h3>
          <p class="balance">${n(player.gold_bars)}</p>
          <p class="stamp">Convert with /shop</p>
        </article>
      </div>

      <article class="panel pass-status">
        <div>
          <p class="kicker">Patron</p>
          <p class="pass-flag ${passOn ? 'on' : 'off'}">${passOn ? 'Tier 1' : 'Off'}</p>
        </div>
        <p>${passOn ? 'Unlocked by lifetime Gold Bars bought (2,600+). Extra daily Bonds and occasional hints in Discord.' : 'Not active. Buy 2,600+ Gold Bars (lifetime, net of refunds) to unlock tier 1.'}</p>
        <p class="hint">Hints may pause if you haven’t been in the server. Logging into this website doesn’t count. Patron is not a Paddle subscription.</p>
        <a class="btn ${passOn ? 'btn-ghost' : 'btn-gold'}" href="/store">${passOn ? 'Back to shop' : 'Shop Gold Bars'}</a>
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
