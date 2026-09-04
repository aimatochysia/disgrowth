import { html } from '../lib/html.js';
import { discordAvatarUrl } from '../session.js';

function n(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function fmtUtc(value) {
  if (!value) return 'No end date on file';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'No end date on file';
  const text = d.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
  return `${text} UTC`;
}

export function accountPage({ user, player, dbReady }) {
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

  const passOn = Boolean(player.subscription_active) && (
    !player.subscription_expires_at || new Date(player.subscription_expires_at) > new Date()
  );
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
          <p class="pass-flag ${passOn ? 'on' : 'off'}">${passOn ? 'On' : 'Off'}</p>
        </div>
        <p>${passOn ? `Active until ${fmtUtc(player.subscription_expires_at)}` : 'Not active'}</p>
        <p class="hint">Included with Gold Bar packs from $25. Extra daily Bonds and occasional hints in Discord. Hints may pause if you haven’t been in the server. Logging into this website doesn’t count.</p>
        <a class="btn ${passOn ? 'btn-ghost' : 'btn-gold'}" href="/store">${passOn ? 'Back to shop' : 'Shop Gold Bars'}</a>
      </article>
    </section>
  `;
}
