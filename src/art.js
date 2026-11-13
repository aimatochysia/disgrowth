import fs from 'node:fs';
import path from 'node:path';

// Landing page: scroll-locked parallax scenes. A scene is a stack of layers named scene-<n>-<layer>.png|webp|jpg in
// public/shots, back to front, all the same size (3400x1200, shown zoomed to 16:9 around the middle). 1_5 means layer 1.5.
// Layers 1 and 6 never move; the others wiggle with the pointer (depths in app.css). A scene with no files shows one
// labelled box. To add or reorder scenes, edit SCENES (and its copy in src/views/home.js).
export const LAYER_SIZE = { w: 3400, h: 1200 };
export const LAYERS = ['1', '1_5', '2', '3', '4', '5', '6', '7'];
export const SCENES = ['scene-1', 'scene-2', 'scene-3', 'scene-4'];
export const layerSlot = (scene, layer) => `${scene}-${layer}`;

// Gold Bar shop icon (not placed on a page yet).
export const SHOP_SLOTS = [{ slot: 'gold-bar', label: 'Gold Bar icon', w: 128, h: 128 }];

export function detectShots(rootDir) {
  const found = {};
  const slots = [
    ...SCENES.flatMap((scene) => LAYERS.map((layer) => layerSlot(scene, layer))),
    ...SHOP_SLOTS.map((entry) => entry.slot),
  ];
  for (const slot of slots) {
    for (const ext of ['webp', 'jpg', 'png']) {
      if (fs.existsSync(path.join(rootDir, 'public', 'shots', `${slot}.${ext}`))) {
        found[slot] = `/shots/${slot}.${ext}`;
        break;
      }
    }
  }
  return found;
}
