import { html } from '../lib/html.js';
import { discordAvatarUrl } from '../session.js';

function n(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function fmtUtc(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toISOString().replace('.000', '')} UTC`;
}

export function accountPage({ user, player, dbReady }) {
  if (!dbReady) {
    return html`
      <section class="page-hero">
        <p class="kicker">— Account</p>
        <h1 class="display display-page">${user.globalName || user.username}</h1>
        <p class="lede narrow">The game database is not connected in this environment. Login works; wallets cannot be read.</p>
      </section>
    `;
  }

  if (!player) {
    return html`
      <section class="page-hero">
        <p class="kicker">— Account</p>
        <h1 class="display display-page">${user.globalName || user.username}</h1>
        <p class="lede narrow">No player row. Run <code>/disgrowth</code> in Discord, then refresh. Checkout stays closed until that exists.</p>
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
        <p class="kicker">— Account</p>
        <h1 class="display display-page">${user.globalName || user.username}</h1>
        <p class="hint">Discord id ${user.discordId}</p>
      </div>
    </section>

    ${needsTutorial
      ? html`<p class="flash">Finish the Discord tutorial. Daily Bonds wait until onboarding is complete.</p>`
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
          <p class="stamp">Daily, granted in Discord</p>
        </article>
        <article class="panel wallet wallet-gold">
          <span class="code">GL</span>
          <h3>Gold Bars</h3>
          <p class="balance">${n(player.gold_bars)}</p>
          <p class="stamp">Premium · convert in /shop</p>
        </article>
      </div>

      <article class="panel pass-status">
        <div>
          <p class="kicker">Accountant pass</p>
          <p class="pass-flag ${passOn ? 'on' : 'off'}">${passOn ? 'On' : 'Off'}</p>
        </div>
        <p>Expires ${fmtUtc(player.subscription_expires_at)}</p>
        <p class="hint">Website login is not guild activity. Hints may pause after three real days without server interaction.</p>
        <a class="btn btn-accent" href="/buy/accountant-pass">Manage pass</a>
      </article>
    </section>
  `;
}
