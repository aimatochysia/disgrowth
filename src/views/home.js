import { html } from '../lib/html.js';
import { SHOT_SLOTS } from '../art.js';

const FEATURES = [
  ['Make a living by hand', 'Grow, forage, cook and craft. Every CR is earned by playing: there is no passive income.'],
  ['Four cities', 'Green Marches is a rustic countryside cottage town, Quay Commons a mid-century small town, Metro Flats a dense late-night maze, and Grand Boulevard a clean, minimalist metropolis.'],
  ['Follow a living market', 'Commodity prices rise and fall around the clock, so time your sales. The market is its own: players never move its prices.'],
  ['Watch the companies', 'Company stocks are on the board for you to follow, not to trade.'],
];

// A slot with no file in public/shots stays an empty placeholder (see detectShots).
function shot([slot, label], shots) {
  return html`<figure class="shot">
    ${shots[slot]
      ? html`<img src="${shots[slot]}" alt="${label}" width="1600" height="1000" loading="lazy" />`
      : html`<div class="shot-empty" aria-hidden="true">screenshot</div>`}
    <figcaption>${label}</figcaption>
  </figure>`;
}

export function homePage({ config, shots = {} }) {
  return html`
    <section class="home-top">
      <p class="logo">Disgrowth</p>
      <div class="panel intro">
        <h1>You're moving to the city...</h1>
        <p>You've got 400 CR in paper money, every note you own, and a head full of plans.</p>
        <p>The city is loud, expensive and full of people who started with less. With a key in your pocket and a head full of big dreams, you set out to make it big!</p>
      </div>
    </section>

    <section class="shots" aria-label="Screenshots">
      ${SHOT_SLOTS.map((slot) => shot(slot, shots))}
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
