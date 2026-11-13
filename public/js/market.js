import { evaluate } from './market-formula.js?v=20261029';

(() => {
  const bootEl = document.getElementById('market-boot');
  const host = document.getElementById('market-chart');
  const focus = document.getElementById('market-focus');
  const sub = document.getElementById('market-sub');
  if (!bootEl || !host) return;

  const WINDOWS = new Set(['7D', '1M', '6M', '1Y', '5Y', 'ALL']);
  const ALIASES = { '6h': '1M', '24h': '1M', ytd: '1Y' };
  // Windows the snapshot carries a change for; longer ones show the 1Y change.
  const CHANGE_KEYS = new Set(['7D', '1M', '6M', '1Y']);
  const FORMULAS_KEY = 'disgrowth.formulas.v1';
  const MAX_FORMULAS = 5;
  const LINE_COLORS = ['--accent', '--gold', '--muted', '--positive', '--negative'];

  const agoByTime = new Map();
  let lastTick = { time: Infinity, label: '' };
  let boot = {};
  try {
    boot = JSON.parse(bootEl.textContent || '{}');
  } catch {
    boot = {};
  }

  function normalizeWindow(next) {
    const raw = String(next || '').trim();
    if (WINDOWS.has(raw)) return raw;
    if (ALIASES[raw]) return ALIASES[raw];
    const upper = raw.toUpperCase();
    if (WINDOWS.has(upper)) return upper;
    return '1M';
  }

  let ticker = String(boot.ticker || '');
  let windowKey = normalizeWindow(boot.window);
  let chart = null;
  let priceSeries = null;
  let barCount = 0;
  let lastBars = [];
  let formulas = [];
  const lines = [];
  let quotes = [];
  const view = { q: '', sort: 'ticker' };

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function themeOptions() {
    const up = cssVar('--positive', '#2d6a32');
    const down = cssVar('--negative', '#b3261e');
    return {
      layout: {
        background: { color: cssVar('--panel', '#f7f1e6') },
        textColor: cssVar('--text', '#1c1814'),
        fontFamily: '"Pixelify Sans", system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: cssVar('--border', 'rgba(36, 30, 24, 0.14)') },
        horzLines: { color: cssVar('--border', 'rgba(36, 30, 24, 0.14)') },
      },
      rightPriceScale: { borderColor: cssVar('--border', 'rgba(36, 30, 24, 0.14)') },
      timeScale: {
        borderColor: cssVar('--border', 'rgba(36, 30, 24, 0.14)'),
        timeVisible: false,
        // Bars carry their own relative label. Ticks arrive left to right, so a label equal to the previous tick's is blanked.
        tickMarkFormatter: (time) => {
          const label = agoByTime.get(time) || '';
          const repeat = time > lastTick.time && label === lastTick.label;
          lastTick = { time, label };
          return repeat ? '' : label;
        },
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
      },
      crosshair: { mode: 0 },
      up,
      down,
    };
  }

  function destroyChart() {
    if (chart) {
      chart.remove();
      chart = null;
      priceSeries = null;
      barCount = 0;
      lines.length = 0;
    }
  }

  function chartSize() {
    const rect = host.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
    };
  }

  function ensureChart() {
    if (!window.LightweightCharts) return false;
    destroyChart();
    const theme = themeOptions();
    const size = chartSize();
    chart = window.LightweightCharts.createChart(host, {
      width: size.width,
      height: size.height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: theme.rightPriceScale,
      timeScale: theme.timeScale,
      localization: { timeFormatter: (time) => agoByTime.get(time) || '' },
      crosshair: theme.crosshair,
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    priceSeries = chart.addLineSeries({ color: theme.up, lineWidth: 2, priceLineVisible: false });
    return true;
  }

  function fitView() {
    if (!chart || barCount < 1) return;
    chart.timeScale().fitContent();
    priceSeries?.priceScale().applyOptions({ autoScale: true });
  }

  function markSelected() {
    document.querySelectorAll('.quote-row').forEach((row) => {
      row.classList.toggle('is-on', row.getAttribute('data-ticker') === ticker);
    });
    document.querySelectorAll('.market-window[data-window]').forEach((btn) => {
      btn.classList.toggle('is-on', btn.getAttribute('data-window') === windowKey);
    });
    if (focus) focus.textContent = ticker || '—';
    if (sub) {
      const quote = quotes.find((q) => q.ticker === ticker);
      sub.textContent = (quote && boot.notes?.[ticker]) || '';
    }
  }

  // ---- formulas: typed by the player, run here on the bars, kept in this browser only
  function loadFormulas() {
    try {
      const saved = JSON.parse(localStorage.getItem(FORMULAS_KEY) || '[]');
      formulas = Array.isArray(saved) ? saved.filter((f) => typeof f === 'string').slice(0, MAX_FORMULAS) : [];
    } catch {
      formulas = [];
    }
  }

  function saveFormulas() {
    try {
      localStorage.setItem(FORMULAS_KEY, JSON.stringify(formulas));
    } catch {
      /* private mode: the lines last until the page closes */
    }
  }

  function renderFormulaChips() {
    const host = document.getElementById('market-formulas');
    if (!host) return;
    host.replaceChildren(
      ...formulas.map((formula, i) => {
        const chip = el('button', 'market-chip', `${formula} ×`);
        chip.type = 'button';
        chip.dataset.formula = String(i);
        chip.style.borderColor = cssVar(LINE_COLORS[i % LINE_COLORS.length], '#888');
        return chip;
      })
    );
  }

  function drawFormulas() {
    if (!chart) return;
    for (const series of lines.splice(0)) chart.removeSeries(series);
    formulas.forEach((formula, i) => {
      let data;
      try {
        data = evaluate(formula, lastBars);
      } catch {
        return;
      }
      const series = chart.addLineSeries({
        color: cssVar(LINE_COLORS[i % LINE_COLORS.length], '#888'),
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(data);
      lines.push(series);
    });
  }

  function addFormula(source) {
    const note = document.getElementById('market-formula-note');
    try {
      evaluate(source, lastBars.length ? lastBars : [{ t: 0, c: 1 }]);
    } catch (err) {
      if (note) note.textContent = err.message;
      return false;
    }
    if (note) note.textContent = '';
    if (formulas.length >= MAX_FORMULAS) formulas.shift();
    formulas.push(source.trim());
    saveFormulas();
    renderFormulaChips();
    drawFormulas();
    return true;
  }

  async function loadOhlc() {
    if (!ticker) {
      destroyChart();
      host.replaceChildren();
      return;
    }
    const url = `/api/market/ohlc?ticker=${encodeURIComponent(ticker)}&window=${encodeURIComponent(windowKey)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'default' });
    if (!res.ok) {
      destroyChart();
      host.replaceChildren();
      return;
    }
    const payload = await res.json();
    const bars = Array.isArray(payload.bars) ? payload.bars : [];
    if (!bars.length) {
      destroyChart();
      host.replaceChildren();
      return;
    }
    if (!ensureChart()) {
      host.textContent = 'Chart unavailable.';
      return;
    }
    agoByTime.clear();
    for (const bar of bars) agoByTime.set(bar.t, bar.ago);
    priceSeries.setData(bars.map((bar) => ({ time: bar.t, value: bar.c })));
    barCount = bars.length;
    lastBars = bars;
    drawFormulas();
    fitView();
  }


  // ---- list: commodities only, searched and sorted here
  function changeOf(quote) {
    return quote.changes?.[CHANGE_KEYS.has(windowKey) ? windowKey : '1Y'] ?? 0;
  }

  function fmtChange(n) {
    return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;
  }

  function filtered() {
    const needle = view.q.trim().toLowerCase();
    const rows = quotes.filter((quote) => !needle || `${quote.ticker} ${quote.name}`.toLowerCase().includes(needle));
    const by = {
      change: (a, b) => changeOf(b) - changeOf(a),
      price: (a, b) => Number(b.price) - Number(a.price),
      volume: (a, b) => b.vol - a.vol,
      ticker: (a, b) => a.ticker.localeCompare(b.ticker),
    }[view.sort] || ((a, b) => a.ticker.localeCompare(b.ticker));
    return rows.sort((a, b) => by(a, b) || a.ticker.localeCompare(b.ticker));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderList() {
    const rows = filtered();
    document.getElementById('market-rows').replaceChildren(
      ...rows.map((quote) => {
        const row = el('a', `quote-row${quote.ticker === ticker ? ' is-on' : ''}`);
        row.href = `/market/${encodeURIComponent(quote.ticker)}`;
        row.dataset.ticker = quote.ticker;
        const change = changeOf(quote);
        row.append(
          el('span', 'quote-sym', quote.ticker),
          el('span', 'quote-name', quote.name),
          el('span', 'quote-px', quote.price),
          el('span', `quote-chg ${change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}`, fmtChange(change))
        );
        return row;
      })
    );
    document.getElementById('market-empty').hidden = rows.length > 0;
  }

  function renderAll() {
    if (document.getElementById('market-rows')) renderList();
  }

  async function loadSnapshot() {
    const res = await fetch('/api/market/snapshot', { headers: { accept: 'application/json' } });
    if (!res.ok) return;
    quotes = (await res.json()).quotes || [];
    renderAll();
    markSelected();
  }

  // The page's own address: /market/FUEL on its own page, ?ticker= on the list page.
  function pageUrl() {
    const w = `window=${encodeURIComponent(windowKey)}`;
    if (boot.solo) return `/market/${encodeURIComponent(ticker)}?${w}`;
    return ticker ? `/market?ticker=${encodeURIComponent(ticker)}&${w}` : `/market?${w}`;
  }

  function setTicker(next) {
    const value = String(next || '').toUpperCase();
    if (!value || value === ticker) return;
    ticker = value;
    persistPrefs();
    markSelected();
    destroyChart();
    loadOhlc().catch(() => {});
    history.replaceState(null, '', pageUrl());
  }

  function setWindow(next) {
    const value = normalizeWindow(next);
    if (value === windowKey) return;
    windowKey = value;
    persistPrefs();
    markSelected();
    renderAll();
    loadOhlc().catch(() => {});
    history.replaceState(null, '', pageUrl());
  }

  function persistPrefs() {
    if (!window.DisgrowthVault) return;
    window.DisgrowthVault.write({ ticker, window: windowKey }).catch(() => {});
  }

  async function restorePrefs() {
    const vault = window.DisgrowthVault;
    if (!vault) return;
    try {
      const cached = await vault.read();
      if (!boot.fromTickerQuery && cached.ticker) ticker = cached.ticker;
      if (!boot.fromWindowQuery && cached.window) {
        const restored = vault.sanitizeWindow
          ? vault.sanitizeWindow(cached.window)
          : normalizeWindow(cached.window);
        if (WINDOWS.has(restored)) windowKey = restored;
      }
    } catch {
      /* ignore */
    }
  }

  document.querySelector('.market-lists')?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-ticker]');
    if (!row) return;
    event.preventDefault();
    setTicker(row.getAttribute('data-ticker'));
  });

  document.querySelector('.market-screen')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-formula]');
    if (chip) {
      formulas.splice(Number(chip.dataset.formula), 1);
      saveFormulas();
      renderFormulaChips();
      drawFormulas();
      return;
    }
    const btn = event.target.closest('[data-window]');
    if (!btn) return;
    event.preventDefault();
    setWindow(btn.getAttribute('data-window'));
  });

  loadFormulas();
  renderFormulaChips();
  document.getElementById('market-formula-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('market-formula');
    if (input.value.trim() && addFormula(input.value)) input.value = '';
  });

  const controls = {
    'market-search': ['q', 'input'],
    'market-sort': ['sort', 'change'],
  };
  for (const [id, [key, type]] of Object.entries(controls)) {
    document.getElementById(id)?.addEventListener(type, (event) => {
      view[key] = event.target.value;
      renderAll();
    });
  }

  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      document.getElementById('market-search')?.focus();
    }
  });

  const resize = new ResizeObserver(() => {
    if (chart) chart.applyOptions(chartSize());
  });
  resize.observe(host);

  restorePrefs()
    .then(() => {
      if (ticker) history.replaceState(null, '', pageUrl());
      persistPrefs();
      markSelected();
      loadSnapshot().catch(() => {});
      return loadOhlc();
    })
    .catch(() => {});
})();
