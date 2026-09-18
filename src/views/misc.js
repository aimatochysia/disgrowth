import { html } from '../lib/html.js';
import { formatQty } from '../catalog.js';
import { discordSvg } from './layout.js';
import { getLegalDoc, legalBookPage, legalToc } from '../legal.js';

export function loginPage({ next, oauthReady, error }) {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Log in with Discord</h1>
      <p class="lede narrow">
        Confirm it’s you so purchases land on your character. No password on this site.
      </p>
      ${error ? html`<p class="flash" role="alert">${error}</p>` : ''}
      ${oauthReady
        ? html`<a class="btn btn-discord" href="/auth/discord?next=${encodeURIComponent(next)}">${discordSvg()} Continue to Discord</a>`
        : html`<p class="flash" role="status">Login isn’t available yet. Try again later.</p>`}
    </section>
  `;
}

export function oauthContinuePage(next) {
  const href = String(next || '/store');
  const safeAttr = href
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${safeAttr}" />
  <title>Signing in…</title>
</head>
<body>
  <p>Signed in. <a href="${safeAttr}">Continue</a></p>
  <script>location.replace(${JSON.stringify(href)})</script>
</body>
</html>`;
}

export function successPage(opts) {
  return welcomePage(opts);
}

export function welcomePage({ user, player } = {}) {
  const character = user?.globalName || user?.username || '';
  const gold = formatQty(player?.gold_bars ?? 0);
  const bonds = formatQty(player?.bonds ?? 0);

  return html`
    <section class="page-hero">
      <p class="kicker">Checkout</p>
      <h1 class="display display-page">Purchase complete</h1>
      <p class="lede narrow">Gold Bars are on your Discord character.</p>
    </section>

    <section class="band tight">
      ${player
        ? html`
            <div class="wallet-grid success-wallets">
              <article class="panel wallet wallet-gold">
                <span class="code">GL</span>
                <h3>Gold Bars</h3>
                <p class="balance">${gold}</p>
                <p class="stamp">On your character</p>
              </article>
              <article class="panel wallet">
                <span class="code">BN</span>
                <h3>Bonds</h3>
                <p class="balance">${bonds}</p>
                <p class="stamp">Spend in Discord</p>
              </article>
            </div>
          `
        : ''}

      <div class="panel buy-summary">
        <dl class="facts">
          <div><dt>Status</dt><dd>Confirmed</dd></div>
          <div><dt>Delivered to</dt><dd>${character || 'Your Discord character'}</dd></div>
          <div><dt>Receipt</dt><dd>Paddle emailed it</dd></div>
        </dl>
        <p class="hint">A first Gold Bar pack also adds the same number of Bonds. Later packs are Gold Bars only.</p>
      </div>

      <div class="cta-row success-actions">
        <a class="btn btn-accent" href="/account">View account</a>
        <a class="btn btn-ghost" href="/store">Back to shop</a>
      </div>

      <ol class="steps">
        <li><strong>Check your Gold Bars</strong> on the account page, or in Discord.</li>
        <li><strong>Run <code>/shop</code> in Discord</strong> when you want to convert Gold Bars to Bonds.</li>
        <li><strong>If the balance is still catching up,</strong> wait a few seconds and refresh.</li>
      </ol>
    </section>
  `;
}

export function supportPage({ config }) {
  const invite = config.DISCORD_SUPPORT_INVITE || config.DISCORD_COMMUNITY_INVITE;
  const inviteLink = invite
    ? html`<p><a class="text-link" href="${invite}" rel="noopener">Discord community</a></p>`
    : '';

  return html`
    <section class="page-hero">
      <h1 class="display display-page">Help</h1>
      <p class="lede narrow">
        Purchases need a Discord login so they attach to your character. Tell us your Discord name. If you paid, include the receipt email.
      </p>
      <div class="panel">
        <p>Email <a href="mailto:${config.SUPPORT_EMAIL}">${config.SUPPORT_EMAIL}</a></p>
        ${inviteLink}
        <p class="hint">We aim to answer in ${String(config.SLA_DAYS)} business days.</p>
      </div>
    </section>
  `;
}

export function legalHubPage(config) {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Policies</h1>
      <p class="lede narrow">Terms, privacy, refunds, cookies, and virtual items — in one place.</p>
    </section>
    <nav class="legal-toc" aria-label="Chapters">
      ${legalToc()}
    </nav>
    <article class="legal-doc legal-book">
      ${legalBookPage(config)}
    </article>
  `;
}

export function legalDocPage(doc) {
  return html`
    <article class="legal-doc">
      <p class="kicker">${doc.kicker}</p>
      <h1 class="display display-page">${doc.title}</h1>
      <div class="legal-body">
        ${doc.html}
      </div>
      <p><a class="text-link" href="/legal">All policies →</a></p>
    </article>
  `;
}

export function notFoundPage() {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Not found</h1>
      <p class="lede narrow">That page isn’t part of the store.</p>
      <a class="btn btn-accent" href="/">Home</a>
    </section>
  `;
}

export { getLegalDoc };
