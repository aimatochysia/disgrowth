import fs from 'node:fs';
import path from 'node:path';

// Parallax backdrop behind the home and shop pages: 8 same-size layers, back to front, named bg-<layer>.png (or .webp,
// .jpg) in public/shots, drawn 3400x1200 and shown zoomed to fill the screen around the middle. Layers 1 and 7 stay
// put, 2 and 5 (clouds) only drift, the rest follow the mouse (eased) or sway on touch screens (depths in app.css).
export const LAYER_SIZE = { w: 3400, h: 1200 };
export const LAYERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const layerSlot = (layer) => `bg-${layer}`;

// Gold Bar shop icon (not placed on a page yet).
export const SHOP_SLOTS = [{ slot: 'gold-bar', label: 'Gold Bar icon', w: 128, h: 128 }];

export function detectShots(rootDir) {
  const found = {};
  const slots = [
    ...LAYERS.map(layerSlot),
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
