import { html } from '../lib/html.js';
import { AVATAR_SLOTS, CROP_SLOTS, SHOT_SLOTS } from '../art.js';

const FEATURES = [
  ['Make a living by hand', 'Grow, forage, cook and craft. Every CR is earned by playing: there is no passive income.'],
  ['Follow a living market', 'Commodity prices rise and fall around the clock, so time your sales. The market is its own: players never move its prices.'],
  ['Watch the companies', 'Company stocks are on the board for you to follow, not to trade.'],
];

// A slot with no file in public/shots stays a labelled box showing the size to draw (see detectShots).
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function art({ slot, label, w, h }, shots, extra = '') {
  const ratio = `ratio-${w / gcd(w, h)}-${h / gcd(w, h)}`; // CSS classes, because the CSP forbids style attributes
  return shots[slot]
    ? html`<img class="art ${ratio} ${extra}" src="${shots[slot]}" alt="${label}" width="${w}" height="${h}" loading="lazy" />`
    : html`<div class="art art-empty ${ratio} ${extra}" data-art="${slot}" role="img" aria-label="${label}"><b>${label}</b><span>${w} × ${h}</span></div>`;
}

const [PLOT, ...STAGES] = CROP_SLOTS.slice(0, 4);
const CAN = CROP_SLOTS[4];

export function homePage({ config, shots = {} }) {
  return html`
    <section class="home-top">
      <p class="logo">Disgrowth</p>
      <div class="panel intro">
        <h1>Start small. Grow something.</h1>
        <p>You've got 400 CR in paper money, every note you own, and a head full of plans.</p>
        <p>Four cities, from a quiet countryside cottage to a minimalist metropolis, and a market that moves whether you are watching or not. Plant, forage, craft, and pick your moment to sell.</p>
      </div>
    </section>

    <section class="hero-art">${art(SHOT_SLOTS[0], shots)}</section>

    <section class="shots" aria-label="Screenshots">
      ${SHOT_SLOTS.slice(1).map((slot) => html`<figure class="shot">${art(slot, shots)}<figcaption>${slot.label}</figcaption></figure>`)}
    </section>

    <section class="band toys">
      <h2 class="section-title">Try it</h2>
      <div class="toy panel" id="crop-toy" data-stages="${STAGES.length}">
        <h3>Tend a plot</h3>
        <div class="toy-stage">
          <div data-crop="0">${art(PLOT, shots)}</div>
          ${STAGES.map((stage, i) => html`<div data-crop="${i + 1}" hidden>${art(stage, shots)}</div>`)}
        </div>
        <p class="toy-note" id="crop-note" role="status" aria-live="polite">An empty plot. Plant a seed.</p>
        <div class="toy-actions">
          <button type="button" class="btn btn-accent" id="crop-act">Plant a seed</button>
          <span class="toy-can">${art(CAN, shots, 'art-small')}</span>
        </div>
        <p class="hint">Every stage needs a watering, like in the game. Nothing grows while you are away.</p>
      </div>
      <div class="toy panel">
        <h3>Dress up</h3>
        <div class="avatar-stack">${AVATAR_SLOTS.map((slot) => art(slot, shots))}</div>
        <p class="hint">Outfits go here once the art is in.</p>
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">Features</h2>
      <ul class="features">
        ${FEATURES.map(([lead, text]) => html`<li><b>${lead}:</b> ${text}</li>`)}
      </ul>
    </section>

    <div class="cta-row home-links">
      <a class="btn btn-accent" href="${config.DISCORD_COMMUNITY_INVITE}" rel="noopener noreferrer" target="_blank">Join the Discord</a>
      <a class="btn btn-ghost" href="/store">Shop Gold Bars</a>
    </div>
  `;
}
