import { html } from '../lib/html.js';
import { backdrop } from './backdrop.js';

// One section per entry; the page scrolls and snaps to each over the same backdrop. The last carries the buttons.
const COPY = [
  ['Start small. Grow something.', 'You have 400 CR in paper money and a head full of plans.'],
  ['Forage, cook, craft.', 'Every CR is earned by playing. There is no passive income.'],
  ['Make a home.', 'Fill it with furniture, dress your avatar, and share it with a partner.'],
  ['A market that moves on its own.', 'Players never move prices, but prices decide what your goods sell for.'],
];

export function homePage({ config, shots = {} }) {
  const last = COPY.length - 1;
  return html`
    ${backdrop(shots)}
    ${COPY.map(
      ([title, text], i) => html`<section class="snap" aria-label="${title}">
        <div class="scene-copy">
          ${i === 0 ? html`<p class="logo"><img src="/logo.png" alt="" width="256" height="256" />Disgrowth</p>` : ''}
          <h1>${title}</h1>
          <p>${text}</p>
          ${i === last
            ? html`<div class="cta-row">
                <a class="btn btn-accent" href="${config.DISCORD_COMMUNITY_INVITE}" rel="noopener noreferrer" target="_blank">Join the Discord</a>
                <a class="btn btn-ghost" href="/store">Shop Gold Bars</a>
              </div>
              <nav class="snap-links" aria-label="Legal">
                <a href="/support">Support</a> <a href="/legal#terms">Terms</a> <a href="/legal#privacy">Privacy</a>
                <a href="/legal#refunds">Refunds</a> <a href="/legal#cookies">Cookies</a>
              </nav>`
            : ''}
        </div>
      </section>`,
    )}
  `;
}
