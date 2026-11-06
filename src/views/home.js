import { html } from '../lib/html.js';
import { LAYERS, LAYER_SIZE, SCENES, layerSlot } from '../art.js';

// One entry per scene in SCENES. The last scene carries the buttons.
const COPY = [
  ['Start small. Grow something.', 'You have 400 CR in paper money and a head full of plans.'],
  ['Forage, cook, craft.', 'Every CR is earned by playing. There is no passive income.'],
  ['Make a home.', 'Fill it with furniture, dress your avatar, and share it with a partner.'],
  ['A market that moves on its own.', 'Players never move prices, but prices decide what your goods sell for.'],
];

function layer(scene, { name, note }, shots) {
  const slot = layerSlot(scene, name);
  const { w, h } = LAYER_SIZE;
  return shots[slot]
    ? html`<img class="layer layer-${name}" src="${shots[slot]}" alt="" width="${w}" height="${h}" />`
    : html`<div class="layer layer-${name} layer-empty" data-art="${slot}"><b>${slot}</b><span>${note} · ${w} × ${h}</span></div>`;
}

export function homePage({ config, shots = {} }) {
  const last = SCENES.length - 1;
  return html`
    <div class="reel" id="reel" aria-roledescription="carousel" aria-label="Disgrowth">
      ${SCENES.map(
        (scene, i) => html`<section class="panel-scene${i === 0 ? ' is-active' : ''}" data-scene="${i}" aria-label="${COPY[i][0]}">
          <div class="layers" aria-hidden="true">${LAYERS.map((entry) => layer(scene, entry, shots))}</div>
          <div class="scene-copy">
            ${i === 0 ? html`<p class="logo">Disgrowth</p>` : ''}
            <h1>${COPY[i][0]}</h1>
            <p>${COPY[i][1]}</p>
            ${i === last
              ? html`<div class="cta-row">
                  <a class="btn btn-accent" href="${config.DISCORD_COMMUNITY_INVITE}" rel="noopener noreferrer" target="_blank">Join the Discord</a>
                  <a class="btn btn-ghost" href="/store">Shop Gold Bars</a>
                </div>
                <nav class="reel-links" aria-label="Legal">
                  <a href="/support">Support</a> <a href="/legal#terms">Terms</a> <a href="/legal#privacy">Privacy</a>
                  <a href="/legal#refunds">Refunds</a> <a href="/legal#cookies">Cookies</a>
                </nav>`
              : ''}
          </div>
        </section>`,
      )}
      <nav class="reel-dots" aria-label="Scenes">
        ${SCENES.map((_scene, i) => html`<button type="button" data-go="${i}" aria-label="Scene ${i + 1}"${i === 0 ? html` aria-current="true"` : ''}></button>`)}
      </nav>
      <div class="reel-fade" aria-hidden="true"></div>
    </div>
  `;
}
