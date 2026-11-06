import fs from 'node:fs';
import path from 'node:path';

// Landing page: scroll-locked parallax scenes. Each scene has three layers (back, mid, front) drawn at 2560x1440 so
// they can drift without showing an edge; the front layer is a PNG with transparency. A layer without a file in
// public/shots is a labelled box. To add or reorder scenes, edit SCENES (and its copy in src/views/home.js).
export const LAYER_SIZE = { w: 2560, h: 1440 };
export const LAYERS = [
  { name: 'back', note: 'sky and far distance' },
  { name: 'mid', note: 'middle ground, transparent PNG' },
  { name: 'front', note: 'foreground, transparent PNG' },
];
export const SCENES = ['scene-1', 'scene-2', 'scene-3', 'scene-4'];
export const layerSlot = (scene, layer) => `${scene}-${layer}`;

// Gold Bar shop icon (not placed on a page yet).
export const SHOP_SLOTS = [{ slot: 'gold-bar', label: 'Gold Bar icon', w: 128, h: 128 }];

export function detectShots(rootDir) {
  const found = {};
  const slots = [
    ...SCENES.flatMap((scene) => LAYERS.map((layer) => layerSlot(scene, layer.name))),
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
