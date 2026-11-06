import fs from 'node:fs';
import path from 'node:path';

const SLOTS = {
  'sky-day': ['sky-day.webp', 'sky-day.jpg', 'sky-day.png'],
  'sky-night': ['sky-night.webp', 'sky-night.jpg', 'sky-night.png'],
  far: ['far.webp', 'far.png'],
  mid: ['mid.webp', 'mid.png'],
  near: ['near.webp', 'near.png'],
};

export function detectArt(rootDir) {
  const found = {};
  const dir = path.join(rootDir, 'public', 'art');
  for (const [slot, names] of Object.entries(SLOTS)) {
    for (const name of names) {
      if (fs.existsSync(path.join(dir, name))) {
        found[slot] = `/art/${name}`;
        break;
      }
    }
  }
  return found;
}

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

export function artCss(found) {
  const lines = [];
  if (found['sky-day']) {
    lines.push(`html.has-art-sky-day .layer-sky-day{background-image:url("${found['sky-day']}")}`);
  }
  if (found['sky-night']) {
    lines.push(`html.has-art-sky-night .layer-sky-night{background-image:url("${found['sky-night']}")}`);
  }
  if (found.far) {
    lines.push(`html.has-art-far .layer-far .svg-fallback{display:none}`);
    lines.push(`html.has-art-far .layer-far{background-image:url("${found.far}")}`);
  }
  if (found.mid) {
    lines.push(`html.has-art-mid .layer-mid .svg-fallback{display:none}`);
    lines.push(`html.has-art-mid .layer-mid{background-image:url("${found.mid}")}`);
  }
  if (found.near) {
    lines.push(`html.has-art-near .layer-near .svg-fallback{display:none}`);
    lines.push(`html.has-art-near .layer-near{background-image:url("${found.near}")}`);
  }
  return `${lines.join('\n')}\n`;
}

export function artHtmlClass(found) {
  return Object.keys(found)
    .map((slot) => `has-art-${slot}`)
    .join(' ');
}
