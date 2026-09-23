import { html } from '../lib/html.js';
import { discordSvg } from './layout.js';
import { legalBookPage, legalToc } from '../legal.js';

export function loginPage({ next, oauthReady, error }) {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Log in with Discord</h1>
      <p class="lede narrow">Confirm it’s you so purchases land on your character.</p>
      ${error ? html`<p class="flash" role="alert">${error}</p>` : ''}
      ${oauthReady
        ? html`<a class="btn btn-discord" href="/auth/discord?next=${encodeURIComponent(next)}">${discordSvg()} Continue to Discord</a>`
        : html`<p class="flash" role="status">Login is unavailable right now. Try again later.</p>`}
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

export function welcomePage() {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Payment received</h1>
      <p class="lede narrow">Gold Bars usually reach your character within a few seconds, with matching Bonds on your first purchase.</p>
      <div class="cta-row">
        <a class="btn btn-accent" href="/account">View account</a>
        <a class="btn btn-ghost" href="/store">Back to shop</a>
      </div>
      <p class="hint">Not there yet? Wait a moment, then refresh your account.</p>
    </section>
  `;
}

export function supportPage({ config }) {
  const invite = config.DISCORD_SUPPORT_INVITE || config.DISCORD_COMMUNITY_INVITE;
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Support</h1>
      <p class="lede narrow">Email us with your Discord username. For payment questions, include your Paddle receipt email or order ID.</p>
      <div class="cta-row">
        <a class="btn btn-accent" href="mailto:${config.SUPPORT_EMAIL}">${config.SUPPORT_EMAIL}</a>
        <a class="btn btn-ghost" href="${invite}" rel="noopener noreferrer" target="_blank">Discord community</a>
      </div>
      <p class="hint">We aim to reply within ${String(config.SLA_DAYS)} business days.</p>
    </section>
  `;
}

export function legalHubPage(config) {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Legal</h1>
    </section>
    <nav class="legal-toc" aria-label="Policies">
      ${legalToc()}
    </nav>
    <article class="legal-doc">
      ${legalBookPage(config)}
    </article>
  `;
}

export function notFoundPage() {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Page not found</h1>
      <a class="btn btn-accent" href="/">Back to home</a>
    </section>
  `;
}
