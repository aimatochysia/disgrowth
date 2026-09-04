import { html } from '../lib/html.js';
import { sceneMarkup } from './scene.js';
import { discordAvatarUrl } from '../session.js';

export function markSvg(className = 'mark') {
  return html`
    <svg class="${className}" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="10" width="20" height="14" rx="2" fill="currentColor" />
      <path d="M16 8 C16 8 22 12 22 18 C22 22 19 25 16 24 C13 25 10 22 10 18 C10 12 16 8 16 8Z" fill="currentColor" opacity="0.55" />
      <line x1="16" y1="24" x2="16" y2="12" stroke="currentColor" stroke-width="1.2" opacity="0.7" />
    </svg>
  `;
}

function discordSvg() {
  return html`
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.37-.44.86-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04A19.74 19.74 0 0 0 3.68 4.37a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13c.12-.1.25-.2.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01c.12.1.25.2.37.29a.08.08 0 0 1-.01.13 12.3 12.3 0 0 1-1.87.89.08.08 0 0 0-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z"/>
    </svg>
  `;
}

export function layout(data) {
  const {
    title,
    path,
    user,
    config,
    page = 'default',
    description = 'Disgrowth store. Gold Bars for the Discord city market.',
    body,
  } = data;

  const year = new Date().getUTCFullYear();
  const artClass = data.artClass || '';
  const pageTitle = title ? `${title} — Disgrowth` : 'Store — Disgrowth';
  const ownerLine = config.previewLegal ? 'Disgrowth' : config.OPERATOR_LEGAL_NAME;
  const loginNext = path && path !== '/' ? path : '/store';

  return html`<!DOCTYPE html>
<html lang="en" data-theme="day" data-page="${page}" class="${artClass}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <meta name="theme-color" content="#0d1117" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="website" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,360;1,9..144,500&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/app.css" />
  <link rel="stylesheet" href="/art.css" />
  <script src="/js/theme-boot.js"></script>
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  ${sceneMarkup()}

  <div class="ticker" role="presentation">
    <div class="ticker-track">
      ${Array.from({ length: 4 }, () => tickerUnit())}
    </div>
  </div>

  <header class="site-header">
    <a class="brand" href="/">
      ${markSvg('mark')}
      <span class="brand-name">Disgrowth</span>
      <span class="brand-sub">Store</span>
    </a>
    <div class="header-end">
      <div class="nav-cluster">
        <nav class="nav" id="site-nav" aria-label="Primary">
          <a href="/" class="${path === '/' ? 'is-on' : ''}">Home</a>
          <a href="/store" class="${path === '/store' || path.startsWith('/buy') ? 'is-on' : ''}">Shop</a>
          <a href="/legal" class="${path.startsWith('/legal') ? 'is-on' : ''}">Terms</a>
          ${user ? html`<a href="/logout">Log out</a>` : ''}
        </nav>
        <button type="button" class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
          <span class="nav-toggle-bars" aria-hidden="true"></span>
        </button>
      </div>
      <button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false" aria-label="Switch day and night">
        <span class="theme-toggle-face" aria-hidden="true">
          <span class="mini-sun"></span>
          <span class="mini-moon"></span>
        </span>
        <span class="theme-toggle-label" data-theme-label>Day</span>
      </button>
      ${user
        ? html`<a class="btn btn-discord btn-account ${path === '/account' ? 'is-on' : ''}" href="/account"><img src="${discordAvatarUrl(user.discordId, user.avatar)}" alt="" width="22" height="22" /><span>${user.globalName || user.username}</span></a>`
        : html`<a class="btn btn-discord" href="${loginHref(loginNext)}">${discordSvg()} Log in</a>`}
    </div>
  </header>

  <main id="content" class="wrap">
    ${body}
  </main>

  <footer class="site-footer">
    <div class="footer-rule"></div>
    <div class="footer-row">
      <p class="fine">© ${String(year)} ${ownerLine}. Played in Discord. Card payments by Lemon Squeezy.</p>
      <p class="fine muted">Not affiliated with Discord Inc.</p>
      ${config.previewLegal
        ? html`<p class="fine">Store in preview. Policies are still drafts.</p>`
        : ''}
    </div>
    <nav class="footer-links" aria-label="Legal">
      <a href="/support">Help</a>
      <a href="/legal#terms">Terms</a>
      <a href="/legal#privacy">Privacy</a>
      <a href="/legal#refunds">Refunds</a>
      <a href="/legal#cookies">Cookies</a>
      <a href="/legal#virtual-items">Virtual items</a>
    </nav>
  </footer>
  <script src="/js/app.js" defer></script>
</body>
</html>`;
}

function tickerUnit() {
  return html`
    <span>DISGROWTH</span>
    <span class="dot">◆</span>
    <span>CITY MARKET</span>
    <span class="dot">◆</span>
    <span>GOLD BARS</span>
    <span class="dot">◆</span>
    <span>PLAYED IN DISCORD</span>
    <span class="dot">◆</span>
  `;
}

export { discordSvg, discordAvatarUrl };

export function playCta(config) {
  if (config.DISCORD_BOT_PUBLIC_URL) {
    return html`<a class="btn btn-ghost" href="${config.DISCORD_BOT_PUBLIC_URL}" rel="noopener">Open Discord</a>`;
  }
  return html`<p class="hint">In Discord, run <code>/disgrowth</code> to play.</p>`;
}

export function loginHref(next = '/store') {
  return `/login?next=${encodeURIComponent(next)}`;
}
