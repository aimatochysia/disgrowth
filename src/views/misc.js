import { html } from '../lib/html.js';
import { discordSvg } from './layout.js';
import { getLegalDoc, legalIndexPage } from '../legal.js';

export function loginPage({ next, oauthReady, error }) {
  return html`
    <section class="page-hero">
      <p class="kicker">— Session</p>
      <h1 class="display display-page">Login with Discord</h1>
      <p class="lede narrow">
        Identify only. We store your Discord id, username, and avatar hash in an encrypted session cookie. No email scope. No password on this site.
      </p>
      ${error ? html`<p class="flash" role="alert">${error}</p>` : ''}
      ${oauthReady
        ? html`<a class="btn btn-accent" href="/auth/discord?next=${encodeURIComponent(next)}">${discordSvg()} Continue to Discord</a>`
        : html`<p class="flash" role="status">Discord OAuth is not configured in this environment.</p>`}
      <p class="hint">After login you return to ${next}</p>
    </section>
  `;
}

export function successPage() {
  return html`
    <section class="page-hero">
      <p class="kicker">— Payment sent</p>
      <h1 class="display display-page">Usually a few seconds</h1>
      <p class="lede narrow">
        Gold Bars and the pass update after the Lemon Squeezy webhook arrives. This page does not guess your new balance. Open Discord <code>/shop</code>, or refresh the account page.
      </p>
      <div class="cta-row">
        <a class="btn btn-accent" href="/account">Open account</a>
        <a class="btn btn-ghost" href="/store">Back to store</a>
      </div>
    </section>
  `;
}

export function supportPage({ config }) {
  const invite = config.DISCORD_SUPPORT_INVITE
    ? html`<p><a class="text-link" href="${config.DISCORD_SUPPORT_INVITE}" rel="noopener">Discord support server</a></p>`
    : html`<p class="hint">Discord invite is not published yet.</p>`;

  return html`
    <section class="page-hero">
      <p class="kicker">— Support</p>
      <h1 class="display display-page">Help with the store</h1>
      <p class="lede narrow">
        Purchases need Discord login so we can attach them to your character. Include your Discord username and, if you have it, the Lemon Squeezy order id.
      </p>
      <div class="panel">
        <p>Email <a href="mailto:${config.SUPPORT_EMAIL}">${config.SUPPORT_EMAIL}</a></p>
        ${invite}
        <p class="hint">We aim to answer in ${String(config.SLA_DAYS)} business days.</p>
      </div>
    </section>
  `;
}

export function legalHubPage() {
  return html`
    <section class="page-hero">
      <p class="kicker">— Legal</p>
      <h1 class="display display-page">Policies</h1>
      <p class="lede narrow">Drafts until the operator fill-in is complete. Have counsel review before launch.</p>
    </section>
    <section class="band tight">
      <div class="legal-grid">
        ${legalIndexPage()}
      </div>
    </section>
  `;
}

export function legalDocPage(doc) {
  return html`
    <article class="legal-doc">
      <p class="kicker">— ${doc.kicker}</p>
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
      <p class="kicker">MARKET GAME — STORE</p>
      <h1 class="display display-page">Not found</h1>
      <p class="lede narrow">That path is not a store page.</p>
      <a class="btn btn-accent" href="/">Home</a>
    </section>
  `;
}

export { getLegalDoc };
