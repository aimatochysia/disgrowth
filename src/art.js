import fs from 'node:fs';
import path from 'node:path';

// Landing-page art. Each slot is a labelled box with its size until a file named <slot>.webp (or .jpg, .png) is
// dropped in public/shots. Sizes are the final pixels; draw at that size (2x for sprites).
export const SHOT_SLOTS = [
  { slot: 'hero', label: 'Hero: the game world, cosy and wide', w: 2400, h: 1200 },
  { slot: 'forest', label: 'The Forest', w: 1600, h: 900 },
  { slot: 'home', label: 'Your home', w: 1600, h: 900 },
  { slot: 'town', label: 'Town map', w: 1600, h: 900 },
];

// Planting toy sprites, PNG with transparency, bottom-centre anchor.
export const CROP_SLOTS = [
  { slot: 'crop-plot', label: 'Empty plot', w: 256, h: 256 },
  { slot: 'crop-1', label: 'Stage 1: sprout', w: 256, h: 256 },
  { slot: 'crop-2', label: 'Stage 2: growing', w: 256, h: 256 },
  { slot: 'crop-3', label: 'Stage 3: ready to harvest', w: 256, h: 256 },
  { slot: 'crop-can', label: 'Watering can', w: 256, h: 256 },
];

// Dress-up preview: one body and a few outfit layers, aligned to the body.
export const AVATAR_SLOTS = [
  { slot: 'avatar-body', label: 'Avatar body, front view', w: 180, h: 300 },
  { slot: 'avatar-outfit-1', label: 'Outfit layer 1', w: 180, h: 300 },
  { slot: 'avatar-outfit-2', label: 'Outfit layer 2', w: 180, h: 300 },
  { slot: 'avatar-outfit-3', label: 'Outfit layer 3', w: 180, h: 300 },
];

// Gold Bar shop icon (not placed on a page yet).
export const SHOP_SLOTS = [{ slot: 'gold-bar', label: 'Gold Bar icon', w: 128, h: 128 }];

export function detectShots(rootDir) {
  const found = {};
  for (const { slot } of [...SHOT_SLOTS, ...CROP_SLOTS, ...AVATAR_SLOTS, ...SHOP_SLOTS]) {
    for (const ext of ['webp', 'jpg', 'png']) {
      if (fs.existsSync(path.join(rootDir, 'public', 'shots', `${slot}.${ext}`))) {
        found[slot] = `/shots/${slot}.${ext}`;
        break;
      }
    }
  }
  return found;
}
