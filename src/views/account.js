import { html } from '../lib/html.js';
import { discordAvatarUrl } from '../session.js';

function n(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

export function accountPage({ user, player, dbReady, inviteUrl, paddleCustomer = null, portalError = '' }) {
  const name = user.globalName || user.username;

  if (!dbReady) {
    return html`
      <section class="page-hero">
        <h1 class="display display-page">${name}</h1>
        <p class="lede narrow">Wallets are unavailable right now. Try again later.</p>
      </section>
    `;
  }

  if (!player) {
    return html`
      <section class="page-hero">
        <h1 class="display display-page">${name}</h1>
        <p class="lede narrow">This Discord account has no Disgrowth character yet. Run <code>/disgrowth</code> in Discord, then refresh this page.</p>
        <a class="btn btn-accent" href="${inviteUrl}" rel="noopener noreferrer" target="_blank">Open the Discord server</a>
      </section>
    `;
  }

  const onboarding = player.onboarding_step;
  const needsTutorial = onboarding && onboarding !== 'complete' && onboarding !== 'raise_stats';

  return html`
    <section class="page-hero account-hero">
      <img class="avatar" src="${discordAvatarUrl(user.discordId, user.avatar)}" alt="" width="64" height="64" />
      <h1 class="display display-page">${name}</h1>
    </section>

    ${needsTutorial
      ? html`<p class="flash" role="status">Finish the tutorial in Discord to start claiming daily Bonds.</p>`
      : ''}

    ${portalError ? html`<p class="flash" role="alert">${portalError}</p>` : ''}

    <section class="band tight">
      <div class="wallet-grid">
        <article class="panel wallet">
          <span class="code">CR</span>
          <h2>Credits</h2>
          <p class="balance">${n(player.credits)}</p>
          <p class="stamp">Cannot be purchased</p>
        </article>
        <article class="panel wallet">
          <span class="code">BN</span>
          <h2>Bonds</h2>
          <p class="balance">${n(player.bonds)}</p>
          <p class="stamp">Claimed in Discord</p>
        </article>
        <article class="panel wallet wallet-gold">
          <span class="code">GL</span>
          <h2>Gold Bars</h2>
          <p class="balance">${n(player.gold_bars)}</p>
          <p class="stamp">Convert with /shop</p>
        </article>
      </div>

      <div class="cta-row account-actions">
        <a class="btn btn-gold" href="/store">Buy Gold Bars</a>
        ${paddleCustomer
          ? html`<form method="post" action="/account/portal"><button class="btn btn-ghost" type="submit">View invoices</button></form>`
          : ''}
      </div>
    </section>
  `;
}
