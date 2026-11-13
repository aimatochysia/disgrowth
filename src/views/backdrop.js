import { html } from '../lib/html.js';
import { LAYERS, LAYER_SIZE, layerSlot } from '../art.js';

/** The fixed parallax background (public/js/parallax.js moves it); a labelled box until the files exist. */
export function backdrop(shots = {}) {
  const { w, h } = LAYER_SIZE;
  const found = LAYERS.filter((name) => shots[layerSlot(name)]);
  return html`<div class="backdrop" aria-hidden="true">
    ${found.length
      ? found.map((name) => html`<img class="layer layer-${name}" src="${shots[layerSlot(name)]}" alt="" width="${w}" height="${h}" />`)
      : html`<div class="scene-empty"><b>bg-1 … bg-${LAYERS.length}</b><span>${LAYERS.length} layers, back to front · ${w} × ${h} each</span></div>`}
  </div>`;
}
