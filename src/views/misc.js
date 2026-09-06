import { html } from '../lib/html.js';
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

export function successPage() {
  return html`
    <section class="page-hero">
      <h1 class="display display-page">Payment sent</h1>
      <p class="lede narrow">
        Gold Bars — and Patron, if the pack includes it — usually show up in Discord within a few seconds. Open <code>/shop</code>, or check your account here. If this was your first Gold Bar purchase, the bars are doubled. If nothing appears, wait a moment and refresh.
      </p>
      <div class="cta-row">
        <a class="btn btn-accent" href="/account">Open account</a>
        <a class="btn btn-ghost" href="/store">Back to shop</a>
      </div>
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
