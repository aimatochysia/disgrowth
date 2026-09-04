import { html, raw } from '../lib/html.js';

const STARS = Array.from({ length: 42 }, (_, i) => ({
  l: (i * 37) % 100,
  t: (i * 19) % 58,
  s: ((i * 7) % 16) / 10 + 0.7,
  o: ((i * 13) % 45) / 100 + 0.18,
  d: ((i * 11) % 24) / 10 + 1.3,
}));

export function sceneMarkup() {
  return html`
    <div class="scene" aria-hidden="true">
      <div class="layer layer-sky">
        <div class="layer-sky-day"></div>
        <div class="layer-sky-night"></div>
      </div>

      <div class="layer layer-stars" data-depth="0.04">
        ${STARS.map(
          (s) => raw(`<span class="star" style="left:${s.l}%;top:${s.t}%;width:${s.s}px;height:${s.s}px;opacity:${s.o};--dur:${s.d}s"></span>`),
        )}
      </div>

      <div class="layer layer-clouds" data-depth="0.06">${clouds()}</div>

      <div class="layer celestial-par" data-depth="0.09">
        <div class="celestial-axis">
          <div class="orb sun">
            <span class="orb-halo"></span>
            <span class="orb-core sun-core"></span>
            ${sunRays()}
          </div>
          <div class="orb moon">
            <span class="orb-halo moon-halo"></span>
            <span class="orb-core moon-core"></span>
          </div>
        </div>
      </div>

      <div class="layer layer-grid" data-depth="0.02">${ledgerGrid()}</div>

      <div class="layer layer-far" data-depth="0.14">
        <div class="sil sil-day">${farRidge()}</div>
        <div class="sil sil-night">${farRidge()}</div>
      </div>
      <div class="layer layer-fog fog-far" data-depth="0.2"></div>
      <div class="layer layer-mid" data-depth="0.32">
        <div class="sil sil-day">${midCanopy()}</div>
        <div class="sil sil-night">${midCanopy()}</div>
      </div>
      <div class="layer layer-fog fog-near" data-depth="0.42"></div>
      <div class="layer layer-near" data-depth="0.58">
        <div class="sil sil-day">${nearGrove()}</div>
        <div class="sil sil-night">${nearGrove()}</div>
      </div>
      <div class="layer layer-vignette"></div>
    </div>
  `;
}

function sunRays() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30;
    return `<span class="sun-ray" style="transform:rotate(${a}deg)"></span>`;
  });
  return raw(`<span class="sun-rays">${rays.join('')}</span>`);
}

function clouds() {
  return html`
    <svg class="cloud-svg" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMin slice">
      <g class="cloud c1" fill="currentColor">
        <ellipse cx="220" cy="90" rx="90" ry="28" />
        <ellipse cx="280" cy="82" rx="70" ry="24" />
        <ellipse cx="170" cy="86" rx="50" ry="18" />
      </g>
      <g class="cloud c2" fill="currentColor">
        <ellipse cx="1180" cy="70" rx="110" ry="30" />
        <ellipse cx="1260" cy="64" rx="80" ry="22" />
        <ellipse cx="1100" cy="72" rx="55" ry="16" />
      </g>
      <g class="cloud c3" fill="currentColor">
        <ellipse cx="760" cy="40" rx="60" ry="16" />
        <ellipse cx="800" cy="36" rx="40" ry="12" />
      </g>
    </svg>
  `;
}

function ledgerGrid() {
  return html`
    <svg class="grid-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      ${Array.from({ length: 9 }, (_, i) =>
        raw(`<line x1="0" y1="${12 + i * 10}" x2="100" y2="${12 + i * 10}" />`),
      )}
    </svg>
  `;
}

function farRidge() {
  return html`
    <svg class="svg-fallback" viewBox="0 0 1600 520" preserveAspectRatio="xMidYMax slice">
      <path class="ridge" d="M0 310
        C140 280, 210 250, 320 255
        C430 260, 480 210, 580 200
        C700 188, 760 230, 880 215
        C1000 200, 1080 160, 1200 170
        C1320 180, 1400 150, 1600 165
        L1600 520 L0 520 Z" />
      <g class="skyline" opacity="0.55">
        <rect x="402" y="188" width="14" height="42" rx="1" />
        <rect x="420" y="168" width="18" height="62" rx="1" />
        <rect x="442" y="178" width="12" height="52" rx="1" />
        <rect x="456" y="196" width="22" height="34" rx="1" />
        <rect x="980" y="148" width="16" height="48" rx="1" />
        <rect x="1000" y="128" width="24" height="68" rx="1" />
        <rect x="1028" y="158" width="14" height="38" rx="1" />
        <polygon points="420,168 429,150 438,168" />
        <polygon points="1000,128 1012,108 1024,128" />
      </g>
      ${treeClump(180, 268, 1.1)}
      ${treeClump(620, 248, 0.85)}
      ${treeClump(1280, 230, 1.2)}
      ${treeClump(1480, 250, 0.7)}
    </svg>
  `;
}

function midCanopy() {
  return html`
    <svg class="svg-fallback" viewBox="0 0 1600 560" preserveAspectRatio="xMidYMax slice">
      <g class="hall" opacity="0.7">
        <rect x="690" y="250" width="18" height="110" />
        <rect x="760" y="242" width="18" height="118" />
        <rect x="830" y="248" width="18" height="112" />
        <rect x="900" y="238" width="18" height="122" />
        <path d="M670 250 L804 188 L938 250 Z" fill="currentColor" opacity="0.85" />
        <rect x="688" y="248" width="232" height="8" />
      </g>
      ${treeClump(80, 300, 1.6)}
      ${treeClump(280, 320, 1.3)}
      ${treeClump(500, 290, 1.8)}
      ${treeClump(1080, 300, 1.7)}
      ${treeClump(1320, 280, 2)}
      ${treeClump(1520, 330, 1.2)}
      <path class="ridge" d="M0 400 C 200 360, 400 380, 700 350 C 980 320, 1200 370, 1600 340 L1600 560 L0 560 Z" opacity="0.95" />
    </svg>
  `;
}

function nearGrove() {
  return html`
    <svg class="svg-fallback" viewBox="0 0 1600 620" preserveAspectRatio="xMidYMax slice">
      ${fern(40, 480, 1.2)}
      ${fern(1400, 500, 1.4)}
      ${treeClump(-40, 340, 2.4)}
      ${treeClump(1180, 300, 2.6)}
      ${treeClump(1480, 360, 1.8)}
      <path class="ground" d="M0 520 C 300 490, 700 540, 1100 500 C 1400 470, 1600 500, 1600 500 L1600 620 L0 620 Z" />
      <g class="fallen-tape" opacity="0.25">
        <rect x="520" y="530" width="220" height="10" transform="rotate(-8 520 530)" rx="1" />
        <rect x="540" y="548" width="160" height="4" transform="rotate(-8 540 548)" />
      </g>
    </svg>
  `;
}

function treeClump(x, y, scale) {
  const s = scale;
  return raw(`
    <g transform="translate(${x} ${y}) scale(${s})" fill="currentColor">
      <rect x="22" y="48" width="6" height="38" rx="1" opacity="0.85" />
      <ellipse cx="25" cy="36" rx="28" ry="32" />
      <ellipse cx="8" cy="48" rx="16" ry="18" />
      <ellipse cx="42" cy="50" rx="18" ry="20" />
      <ellipse cx="25" cy="18" rx="14" ry="16" />
    </g>
  `);
}

function fern(x, y, scale) {
  return raw(`
    <g transform="translate(${x} ${y}) scale(${scale})" fill="currentColor" opacity="0.9">
      <path d="M8 40 C8 20, 18 8, 28 4 C16 14, 14 28, 16 40 Z" />
      <path d="M16 40 C20 22, 36 10, 48 8 C32 18, 26 30, 24 40 Z" />
      <path d="M4 40 C0 26, -10 16, -18 14 C-4 22, 2 32, 6 40 Z" />
    </g>
  `);
}
