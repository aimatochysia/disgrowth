import { useState, useCallback } from 'react'

// ── Static data ──────────────────────────────────────────────

const TICKER = [
  { sym: 'ROSE', val: '₿ 142.80', chg: '+2.4%', up: true },
  { sym: 'FERN', val: '₿  38.20', chg: '−0.8%', up: false },
  { sym: 'ORCD', val: '₿ 890.00', chg: '+12.1%', up: true },
  { sym: 'MOSS', val: '₿  22.15', chg: '+0.3%', up: true },
  { sym: 'LILY', val: '₿ 267.40', chg: '+5.7%', up: true },
  { sym: 'BAMB', val: '₿  55.90', chg: '−1.2%', up: false },
  { sym: 'CACT', val: '₿ 410.00', chg: '+8.3%', up: true },
  { sym: 'TULP', val: '₿ 188.60', chg: '+3.1%', up: true },
]

const SHOP = [
  {
    id: 'MGF',
    name: 'Morning Glory Futures',
    type: 'Derivative Contract',
    price: '₿ 240.00',
    yield: '+18%',
    yieldLabel: 'seasonal',
    up: true,
    rarity: 'Rare',
    desc: 'Lock in sunrise harvest prices before the market wakes.',
  },
  {
    id: 'CCB',
    name: 'Compound Compost Bond',
    type: 'Fixed Income',
    price: '₿  80.00',
    yield: '+6.5%',
    yieldLabel: 'annual',
    up: true,
    rarity: 'Common',
    desc: 'Nutrient-rich soil notes that compound every quarter.',
  },
  {
    id: 'BOP',
    name: 'Bull Orchid Premium',
    type: 'Growth Equity',
    price: '₿ 1,200',
    yield: '+34%',
    yieldLabel: 'volatile',
    up: true,
    rarity: 'Legendary',
    desc: 'High-risk, high-reward. The rarest bloom in the exchange.',
  },
  {
    id: 'HMS',
    name: 'Hedge Maze Strategy',
    type: 'Market Protection',
    price: '₿ 165.00',
    yield: '−2.1%',
    yieldLabel: 'floor',
    up: false,
    rarity: 'Uncommon',
    desc: 'When the frost comes, your portfolio stays green.',
  },
]

const STARS = Array.from({ length: 36 }, (_, i) => ({
  w: ((i * 7) % 15) / 10 + 1.2,
  l: (i * 37) % 100,
  t: (i * 23) % 62,
  o: ((i * 13) % 50) / 100 + 0.15,
  dur: ((i * 11) % 22) / 10 + 1.2,
}))

const FEATURES = [
  {
    n: '01',
    title: 'Live Plant Markets',
    body: 'Watch your roses spike when spring arrives early. Hedge with hardy succulents. Short the tulip bubble before it pops.',
  },
  {
    n: '02',
    title: 'Greenhouse Management',
    body: 'Expand plots, upgrade irrigation, hire botanist analysts to improve yield projections each season.',
  },
  {
    n: '03',
    title: 'Seasonal Earnings Reports',
    body: 'Every harvest triggers a full financial summary — bloom rate, soil ROI, pest insurance claims, all on the ledger.',
  },
  {
    n: '04',
    title: 'Cross-Pollination Derivatives',
    body: 'Synthetic plant hybrids that track indices of multiple species. High risk. Extraordinary reward.',
  },
]

const RARITY_STYLE: Record<string, { bg: string; color: string }> = {
  Legendary: { bg: 'rgba(212,160,85,0.18)', color: '#d4a055' },
  Rare:      { bg: 'rgba(138,184,90,0.18)', color: '#8ab85a' },
  Uncommon:  { bg: 'rgba(100,160,220,0.18)', color: '#7ab0dc' },
  Common:    { bg: 'rgba(160,160,160,0.13)', color: '#909090' },
}

// ── SVG components ───────────────────────────────────────────

function LeafSVG({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} fill="currentColor">
      <path d="M20 4C20 4 36 12 36 24C36 32 28 38 20 36C12 38 4 32 4 24C4 12 20 4 20 4Z" opacity="0.85" />
      <line x1="20" y1="36" x2="20" y2="10" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
      <line x1="20" y1="28" x2="29" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <line x1="20" y1="22" x2="11" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.35" />
    </svg>
  )
}

function ChartSVG({ dark }: { dark: boolean }) {
  const stroke = dark ? '#8ab85a' : '#6b8c3e'
  return (
    <svg viewBox="0 0 320 100" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,80 L18,70 L36,75 L55,58 L74,65 L93,50 L112,55 L131,40 L150,44 L169,30 L188,34 L207,22 L226,26 L245,14 L264,18 L283,9 L302,12 L320,8"
        fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M0,80 L18,70 L36,75 L55,58 L74,65 L93,50 L112,55 L131,40 L150,44 L169,30 L188,34 L207,22 L226,26 L245,14 L264,18 L283,9 L302,12 L320,8 L320,100 L0,100Z"
        fill="url(#cg)"
      />
      {[55, 93, 131, 169, 207, 245].map((x, i) => {
        const ys = [53, 45, 35, 25, 17, 9]
        return <rect key={i} x={x - 3} y={ys[i] - 5} width="6" height="12" fill={stroke} opacity="0.45" rx="1" />
      })}
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.128 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

// ── Main component ───────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(false)
  const [hoveredShop, setHoveredShop] = useState<number | null>(null)
  const toggle = useCallback(() => setDark(d => !d), [])

  // Color aliases
  const ink = dark ? '#dbecd4' : '#2c2118'
  const inkFaint = dark ? 'rgba(219,236,212,0.45)' : 'rgba(44,33,24,0.45)'
  const inkGhost = dark ? 'rgba(219,236,212,0.15)' : 'rgba(44,33,24,0.1)'
  const inkTiny = dark ? 'rgba(219,236,212,0.3)' : 'rgba(44,33,24,0.28)'
  const accent = dark ? '#8ab85a' : '#5a7a3a'
  const warm = dark ? '#c8a060' : '#a06828'
  const glassBg = dark ? 'rgba(10,22,16,0.42)' : 'rgba(255,255,255,0.42)'
  const glassBorder = dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.72)'

  const panelStyle = {
    background: glassBg,
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    border: `1px solid ${glassBorder}`,
  } as React.CSSProperties

  return (
    <div className={`min-h-screen relative overflow-x-hidden transition-colors duration-700 font-sans${dark ? ' dark' : ''}`}>

      {/* ── Sky background ── */}
      <div
        className="fixed inset-0 transition-all duration-[1200ms] z-0"
        style={{
          background: dark
            ? 'radial-gradient(ellipse at 72% 8%, #1c3048 0%, #0c1a2c 38%, #081218 100%)'
            : 'radial-gradient(ellipse at 62% 0%, #fde9b4 0%, #f8d285 20%, #f4e8d8 55%, #ece0d0 100%)',
        }}
      />

      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: dark ? 0.05 : 0.04,
        }}
      />

      {/* Ledger grid lines */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 transition-colors duration-700"
            style={{ top: `${8 + i * 9}%`, height: '1px', background: inkGhost }}
          />
        ))}
      </div>

      {/* ── Sun ── */}
      <div
        className="fixed z-0 pointer-events-none transition-all duration-[1400ms] ease-in-out"
        style={{ right: '9%', top: dark ? '-140px' : '52px' }}
      >
        <div
          className="w-32 h-32 rounded-full transition-all duration-[1400ms]"
          style={{
            background: 'radial-gradient(circle, #ffe266 0%, #f5a820 52%, transparent 100%)',
            boxShadow: dark ? 'none' : '0 0 90px rgba(255,200,50,0.55), 0 0 200px rgba(245,168,32,0.22)',
            opacity: dark ? 0 : 1,
          }}
        />
      </div>

      {/* ── Moon ── */}
      <div
        className="fixed z-0 pointer-events-none transition-all duration-[1400ms] ease-in-out"
        style={{ right: '13%', bottom: dark ? '18%' : '-160px' }}
      >
        <div
          className="w-24 h-24 rounded-full transition-all duration-[1400ms]"
          style={{
            background: dark
              ? 'radial-gradient(circle at 38% 36%, #f0f0e8 0%, #b8c8d4 65%, transparent 100%)'
              : 'transparent',
            boxShadow: dark ? '0 0 50px rgba(180,200,220,0.25), 0 0 100px rgba(180,200,220,0.1)' : 'none',
            opacity: dark ? 1 : 0,
          }}
        />
      </div>

      {/* ── Stars ── */}
      <div
        className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-700"
        style={{ opacity: dark ? 1 : 0 }}
      >
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white star-pulse"
            style={{
              width: s.w + 'px', height: s.w + 'px',
              left: s.l + '%', top: s.t + '%',
              opacity: s.o,
              '--dur': s.dur + 's',
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Content ── */}
      <div className="relative z-20">

        {/* ─── TICKER TAPE ─────────────────────────────────── */}
        <div
          className="fixed top-0 left-0 right-0 h-7 z-50 overflow-hidden flex items-center"
          style={{
            background: dark ? 'rgba(4,12,20,0.75)' : 'rgba(30,20,10,0.82)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="animate-ticker flex whitespace-nowrap" style={{ fontFamily: 'DM Mono, monospace' }}>
            {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-5 text-[11px]">
                <span style={{ color: 'rgba(255,235,180,0.3)', fontSize: '8px' }}>◆</span>
                <span style={{ color: 'rgba(255,235,180,0.55)' }}>{t.sym}</span>
                <span style={{ color: 'rgba(255,235,180,0.75)' }}>{t.val}</span>
                <span style={{ color: t.up ? '#7ec850' : '#e07272' }}>{t.chg}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ─── HEADER ──────────────────────────────────────── */}
        <header className="fixed top-7 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-3">
          <div className="flex items-center gap-2">
            <LeafSVG className="w-6 h-6 transition-colors duration-700" style={{ color: accent }} />
            <span
              className="text-[11px] tracking-[0.2em] uppercase transition-colors duration-700"
              style={{ fontFamily: 'DM Mono, monospace', color: accent }}
            >
              Verdant Exchange
            </span>
          </div>

          <nav className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] transition-all duration-300 hover:scale-105"
              style={{
                fontFamily: 'DM Mono, monospace',
                background: glassBg,
                backdropFilter: 'blur(16px)',
                border: `1px solid ${glassBorder}`,
                color: dark ? '#a0c880' : '#5a7a3a',
              }}
            >
              <span className="text-sm leading-none">{dark ? '☽' : '☀︎'}</span>
              <span>{dark ? 'Night' : 'Daylight'}</span>
            </button>

            <a
              href="#discord"
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #5865F2 0%, #7289DA 100%)',
                color: '#fff',
                boxShadow: '0 2px 20px rgba(88,101,242,0.38)',
              }}
            >
              <DiscordIcon />
              Connect Discord
            </a>
          </nav>
        </header>

        {/* ─── HERO ────────────────────────────────────────── */}
        <section className="relative min-h-screen pt-28 pb-16 px-8 md:px-14 flex flex-col justify-center overflow-hidden">

          {/* Big background chart */}
          <div className="absolute inset-0 flex items-end pb-16 px-6 pointer-events-none" style={{ opacity: 0.13 }}>
            <div className="w-full h-52">
              <ChartSVG dark={dark} />
            </div>
          </div>

          {/* ── Headline ── */}
          <div className="relative">

            {/* Row 1 */}
            <div className="relative">
              <span
                className="block leading-none font-bold tracking-tight transition-colors duration-700"
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 'clamp(3.5rem, 13vw, 12rem)',
                  color: ink,
                  letterSpacing: '-0.025em',
                }}
              >
                Grow
              </span>
            </div>

            {/* Row 2 — italic + injected stat */}
            <div className="flex items-end gap-5 flex-wrap">
              <span
                className="block leading-none font-light italic tracking-tight transition-colors duration-700"
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 'clamp(3.5rem, 13vw, 12rem)',
                  color: accent,
                  letterSpacing: '-0.025em',
                }}
              >
                your
              </span>

              {/* Floating stat injected into headline */}
              <div
                className="mb-6 px-4 py-3 rounded-2xl hidden md:block animate-float"
                style={{ ...panelStyle, '--rot': '2deg' } as React.CSSProperties}
              >
                <div
                  className="text-xl font-bold leading-none mb-1"
                  style={{ fontFamily: 'Fraunces, serif', color: accent }}
                >
                  +24.8%
                </div>
                <div
                  className="text-[9px] tracking-widest uppercase"
                  style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}
                >
                  Portfolio YTD
                </div>
              </div>
            </div>

            {/* Row 3 — with rotated label */}
            <div className="flex items-start gap-8">
              <span
                className="block leading-none font-bold tracking-tight transition-colors duration-700"
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 'clamp(3.5rem, 13vw, 12rem)',
                  color: ink,
                  letterSpacing: '-0.025em',
                }}
              >
                Portfolio
              </span>

              <div
                className="self-center hidden lg:block shrink-0"
                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center center', whiteSpace: 'nowrap', marginLeft: '-2rem' }}
              >
                <span
                  className="text-[10px] tracking-[0.35em] uppercase"
                  style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}
                >
                  Est. Season IV · Botanical Markets
                </span>
              </div>
            </div>
          </div>

          {/* ── Sub-copy + CTA ── */}
          <div className="mt-10 flex flex-col md:flex-row items-start md:items-end gap-8 max-w-2xl">
            <p
              className="text-[15px] leading-relaxed max-w-xs transition-colors duration-700"
              style={{ color: inkFaint }}
            >
              A cozy greenhouse sim where every bloom is a dividend, every harvest a quarterly report.
              Tend your garden. Read the charts. Retire rich.
            </p>
            <div className="flex items-center gap-4 shrink-0">
              <a
                href="#wishlist"
                className="px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${accent} 0%, ${dark ? '#5a8c30' : '#3d5a24'} 100%)`,
                  color: '#fff',
                  boxShadow: `0 4px 28px ${dark ? 'rgba(138,184,90,0.3)' : 'rgba(90,122,58,0.32)'}`,
                }}
              >
                Add to Wishlist
              </a>
              <span
                className="text-[11px]"
                style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}
              >
                Q2 2025 · Early Access
              </span>
            </div>
          </div>

          {/* ── Floating glass panels ── */}

          {/* Orchid chart panel */}
          <div
            className="absolute right-6 md:right-14 top-32 w-52 p-4 rounded-2xl hidden md:block animate-float"
            style={{ ...panelStyle, '--rot': '-2.5deg', transform: 'rotate(-2.5deg)', boxShadow: dark ? '0 12px 48px rgba(0,0,0,0.35)' : '0 12px 48px rgba(0,0,0,0.07)' } as React.CSSProperties}
          >
            <div className="h-20 mb-3">
              <ChartSVG dark={dark} />
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] mb-1" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>ORCD · Bull Orchid</div>
                <div className="text-xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: accent }}>₿ 890</div>
              </div>
              <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'rgba(126,200,80,0.14)', color: '#7ec850', fontFamily: 'DM Mono, monospace' }}>
                +12.1%
              </span>
            </div>
          </div>

          {/* Garden status */}
          <div
            className="absolute right-6 md:right-72 bottom-24 w-44 p-3 rounded-xl hidden md:block animate-float"
            style={{ ...panelStyle, '--rot': '2deg', transform: 'rotate(2deg)', animationDelay: '1.2s' } as React.CSSProperties}
          >
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>
              Today's Garden
            </div>
            {[['🌹 Rose Bed', '78%'], ['🌿 Fern Patch', '45%'], ['🌵 Cacti Row', '91%']].map(([label, pct]) => (
              <div key={label} className="flex justify-between items-center mb-2">
                <span className="text-[12px]" style={{ color: inkFaint }}>{label}</span>
                <span className="text-[11px]" style={{ fontFamily: 'DM Mono, monospace', color: accent }}>{pct}</span>
              </div>
            ))}
          </div>

          {/* Balance chip */}
          <div
            className="absolute left-8 md:left-14 bottom-20 px-4 py-2 rounded-xl hidden lg:flex items-center gap-3 animate-float"
            style={{ ...panelStyle, '--rot': '-1deg', transform: 'rotate(-1deg)', animationDelay: '0.6s' } as React.CSSProperties}
          >
            <span className="text-lg">🌱</span>
            <div>
              <div className="text-[9px] uppercase tracking-widest" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>Available Capital</div>
              <div className="text-base font-semibold" style={{ fontFamily: 'Fraunces, serif', color: warm }}>₿ 4,820.00</div>
            </div>
          </div>
        </section>

        {/* ─── EDITORIAL FEATURES ──────────────────────────── */}
        <section className="relative py-28 px-8 md:px-14">

          <div className="text-[10px] tracking-[0.45em] uppercase mb-20" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>
            — What grows here
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-0 items-start">

            {/* Left: big pull quote + stat tiles */}
            <div className="md:col-span-7 md:pr-20">
              <blockquote
                className="leading-tight font-light italic mb-12 transition-colors duration-700"
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 'clamp(1.9rem, 3.8vw, 3.6rem)',
                  color: ink,
                }}
              >
                "The market opens<br />
                <em style={{ color: accent, fontStyle: 'normal' }}>when the dew settles.</em><br />
                And closes at dusk."
              </blockquote>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Plant Varieties', value: '200+', icon: '🌱' },
                  { label: 'Market Instruments', value: '40+', icon: '📊' },
                  { label: 'Seasonal Events', value: '32', icon: '🌸' },
                  { label: 'Greenhouse Tiles', value: '∞', icon: '🪴' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]" style={panelStyle}>
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="text-3xl font-bold mb-1 transition-colors duration-700" style={{ fontFamily: 'Fraunces, serif', color: accent }}>{s.value}</div>
                    <div className="text-[10px] uppercase tracking-widest" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: feature list */}
            <div className="md:col-span-5 md:pt-16">
              <div className="space-y-0">
                {FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className="py-5 group transition-all duration-200"
                    style={{ borderBottom: `1px solid ${inkGhost}` }}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-[10px] pt-1 shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>{f.n}</span>
                      <div>
                        <h3
                          className="text-base font-semibold mb-1.5 transition-colors duration-300 group-hover:text-opacity-100"
                          style={{ fontFamily: 'Fraunces, serif', color: ink }}
                        >
                          {f.title}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: inkFaint }}>{f.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── REQUISITION LEDGER / SHOP ───────────────────── */}
        <section className="relative py-24 px-8 md:px-14">

          {/* Section header — ledger style */}
          <div
            className="flex flex-col md:flex-row md:items-end justify-between mb-1 pb-4"
            style={{ borderBottom: `2px solid ${dark ? 'rgba(219,236,212,0.18)' : 'rgba(44,33,24,0.14)'}` }}
          >
            <div>
              <div className="text-[10px] tracking-[0.45em] uppercase mb-2" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>
                — Verdant Exchange · Requisition Ledger
              </div>
              <h2
                className="leading-none font-bold transition-colors duration-700"
                style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(2.2rem, 5vw, 4.5rem)', color: ink }}
              >
                The Shop
              </h2>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>Balance</div>
              <div className="text-2xl font-semibold" style={{ fontFamily: 'Fraunces, serif', color: accent }}>₿ 4,820.00</div>
            </div>
          </div>

          {/* Column headers */}
          <div
            className="hidden md:grid grid-cols-12 gap-4 py-2.5 px-4 text-[9px] tracking-[0.3em] uppercase"
            style={{ fontFamily: 'DM Mono, monospace', color: inkTiny, borderBottom: `1px solid ${inkGhost}` }}
          >
            <span className="col-span-1">ID</span>
            <span className="col-span-5">Instrument</span>
            <span className="col-span-3">Notes</span>
            <span className="col-span-1 text-right">Price</span>
            <span className="col-span-1 text-right">Yield</span>
            <span className="col-span-1"></span>
          </div>

          {/* Rows */}
          <div className="space-y-1 mt-1">
            {SHOP.map((item, i) => (
              <div
                key={item.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 py-4 px-4 rounded-xl cursor-pointer transition-all duration-200"
                style={{
                  background: hoveredShop === i
                    ? (dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.58)')
                    : (dark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.32)'),
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${hoveredShop === i ? glassBorder : 'transparent'}`,
                }}
                onMouseEnter={() => setHoveredShop(i)}
                onMouseLeave={() => setHoveredShop(null)}
              >
                {/* ID badge */}
                <div className="md:col-span-1 flex items-center">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-medium"
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      background: RARITY_STYLE[item.rarity].bg,
                      color: RARITY_STYLE[item.rarity].color,
                    }}
                  >
                    {item.id}
                  </span>
                </div>

                {/* Name */}
                <div className="md:col-span-5">
                  <div className="text-sm font-semibold mb-0.5 transition-colors duration-700" style={{ fontFamily: 'Fraunces, serif', color: ink }}>{item.name}</div>
                  <div className="text-[10px]" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>{item.type} · {item.rarity}</div>
                </div>

                {/* Desc */}
                <div className="md:col-span-3 hidden md:flex items-center">
                  <p className="text-xs leading-relaxed" style={{ color: inkFaint }}>{item.desc}</p>
                </div>

                {/* Price */}
                <div className="md:col-span-1 flex md:justify-end items-center">
                  <span className="text-sm font-medium" style={{ fontFamily: 'DM Mono, monospace', color: ink }}>{item.price}</span>
                </div>

                {/* Yield */}
                <div className="md:col-span-1 flex md:justify-end items-center gap-1">
                  <span className="text-sm" style={{ fontFamily: 'DM Mono, monospace', color: item.up ? '#7ec850' : '#e07272' }}>{item.yield}</span>
                  <span className="text-[9px]" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>{item.yieldLabel}</span>
                </div>

                {/* Action */}
                <div className="md:col-span-1 flex md:justify-end items-center">
                  <button
                    className="text-[10px] px-3 py-1 rounded-full transition-all duration-200"
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      background: hoveredShop === i ? (dark ? 'rgba(138,184,90,0.22)' : 'rgba(90,122,58,0.14)') : 'transparent',
                      color: hoveredShop === i ? accent : 'transparent',
                      border: `1px solid ${hoveredShop === i ? accent : 'transparent'}`,
                    }}
                  >
                    Acquire →
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[10px] text-right" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>
            * All prices in Bloom Credits (₿). Subject to seasonal market volatility.
          </p>
        </section>

        {/* ─── DISCORD CTA ─────────────────────────────────── */}
        <section id="discord" className="relative py-20 px-8 md:px-14">
          {/* Glow blob */}
          <div
            className="absolute inset-0 rounded-3xl transition-all duration-700"
            style={{
              background: dark
                ? 'radial-gradient(ellipse at 25% 50%, rgba(88,101,242,0.13) 0%, transparent 65%)'
                : 'radial-gradient(ellipse at 25% 50%, rgba(88,101,242,0.07) 0%, transparent 65%)',
            }}
          />

          <div
            className="relative rounded-3xl p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-10"
            style={panelStyle}
          >
            {/* Decorative corner chart */}
            <div className="absolute top-6 right-6 w-28 h-14 opacity-20 pointer-events-none">
              <ChartSVG dark={dark} />
            </div>

            <div className="max-w-md">
              <div className="text-[10px] tracking-[0.45em] uppercase mb-4" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>
                — Community & Early Access
              </div>
              <h2
                className="leading-tight font-bold mb-4 transition-colors duration-700"
                style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', color: ink }}
              >
                Join the Garden<br />
                <span className="italic" style={{ color: accent }}>Investors' Club</span>
              </h2>
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: inkFaint }}>
                5,000+ botanist-traders sharing market tips, harvest analyses, and greenhouse screenshots.
                Early members get exclusive seed varieties and beta access.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-center gap-3 shrink-0">
              <a
                href="#discord"
                className="flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold transition-all duration-300 hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #5865F2 0%, #7289DA 100%)',
                  color: '#fff',
                  boxShadow: '0 8px 40px rgba(88,101,242,0.42)',
                }}
              >
                <DiscordIcon />
                Connect Discord
              </a>
              <span className="text-[11px]" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>
                Free to join — beta trading opens soon
              </span>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ──────────────────────────────────────── */}
        <footer className="relative py-10 px-8 md:px-14">
          <div className="h-px w-full mb-8" style={{ background: inkGhost }} />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

            <div className="flex items-center gap-2">
              <LeafSVG className="w-5 h-5 opacity-40 transition-colors duration-700" style={{ color: accent }} />
              <span className="text-[11px]" style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}>
                © 2025 Verdant Exchange Studio · All harvests reserved.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              {['Terms of Service', 'Privacy Policy', 'Cookie Preferences', 'Press Kit'].map(link => (
                <a
                  key={link}
                  href="#"
                  className="text-[11px] transition-opacity duration-200 hover:opacity-80"
                  style={{ fontFamily: 'DM Mono, monospace', color: inkTiny }}
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
