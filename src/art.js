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

export function artCss(found) {
  const lines = ['/* generated from public/art — do not edit by hand */'];
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
