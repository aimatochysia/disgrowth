import { html } from '../lib/html.js';
import { SHOT_SLOTS } from '../art.js';

const FEATURES = [
  ['Make a living', 'Find a job, learn a trade, and work your way up from the Green Marches to Grand Boulevard.'],
  ['Rent a room of your own', 'Choose a place in any of four districts, then fill it with furniture that earns its keep.'],
  ['Learn to live in the city', 'Work, study, rest, or do it all! Just mind your energy and your stress. The choice is yours...'],
  ['Start a business', 'Rent a lot, give it a name, pick what it makes, and watch it grow into a company you can list.'],
  ['Follow a living market', 'Prices rise and fall around the clock, whether you are watching or not.'],
  ['Come back to more', 'Your character keeps going while you are away, for up to three days.'],
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
        <p>You've saved 5,000 CR in paper money, every note you own, and bet it all on a small room in the Green Marches.</p>
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
