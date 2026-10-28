import { filterQuotes, heatGroups, tagList } from './market-filter.js?v=20261028';

(() => {
  const bootEl = document.getElementById('market-boot');
  const host = document.getElementById('market-chart');
  const focus = document.getElementById('market-focus');
  const sub = document.getElementById('market-sub');
  if (!bootEl || !host) return;

  const WINDOWS = new Set(['7D', '1M', '6M', '1Y', '5Y', 'ALL']);
  const ALIASES = { '6h': '1M', '24h': '1M', ytd: '1Y' };
  const PAGE_SIZE = 50;
  // Percent move that paints a heatmap tile at full colour, per window.
  const HEAT_SCALE = { '7D': 5, '1M': 10, '6M': 25, '1Y': 40 };
  const INDICATORS = { sma20: ['sma', 20], ema20: ['ema', 20], ema50: ['ema', 50] };

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
  let candleSeries = null;
  let volumeSeries = null;
  let barCount = 0;
  let lastBars = [];
  const active = new Set();
  const lines = new Map();
  let quotes = [];
  const view = { q: '', type: '', tag: '', sort: 'cap', page: 0 };
  const wide = window.matchMedia('(min-width: 901px)');

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
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
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
      candleSeries = null;
      volumeSeries = null;
      barCount = 0;
      lines.clear();
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
    candleSeries = chart.addCandlestickSeries({
      upColor: theme.up,
      downColor: theme.down,
      borderVisible: false,
      wickUpColor: theme.up,
      wickDownColor: theme.down,
    });
    volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    return true;
  }

  function fitView() {
    if (!chart || barCount < 1) return;
    chart.timeScale().fitContent();
    candleSeries?.priceScale().applyOptions({ autoScale: true });
  }

  function applyTheme() {
    if (!chart) return;
    const theme = themeOptions();
    chart.applyOptions({
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: theme.rightPriceScale,
      timeScale: theme.timeScale,
    });
    candleSeries?.applyOptions({
      upColor: theme.up,
      downColor: theme.down,
      wickUpColor: theme.up,
      wickDownColor: theme.down,
    });
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
      sub.textContent = quote ? (quote.type === 'commodity' ? boot.notes?.[ticker] : quote.focus) || '' : '';
    }
  }

  // ---- indicators: a fixed whitelist computed here from the bars, never user code
  function movingAverage(kind, period, bars) {
    const out = [];
    let prev = null;
    let sum = 0;
    bars.forEach((bar, i) => {
      sum += bar.c;
      if (i >= period) sum -= bars[i - period].c;
      if (kind === 'sma') {
        if (i >= period - 1) out.push({ time: bar.t, value: sum / period });
        return;
      }
      prev = prev == null ? bar.c : bar.c * (2 / (period + 1)) + prev * (1 - 2 / (period + 1));
      if (i >= period - 1) out.push({ time: bar.t, value: prev });
    });
    return out;
  }

  function drawIndicators() {
    if (!chart) return;
    for (const [key, series] of lines) {
      if (!active.has(key)) {
        chart.removeSeries(series);
        lines.delete(key);
      }
    }
    for (const key of active) {
      const [kind, period] = INDICATORS[key];
      if (!lines.has(key)) {
        lines.set(
          key,
          chart.addLineSeries({
            color: key === 'ema50' ? cssVar('--muted', '#8a8279') : cssVar('--accent', '#b5651d'),
            lineWidth: key === 'sma20' ? 1 : 2,
            lineStyle: kind === 'sma' ? 2 : 0,
            priceLineVisible: false,
            lastValueVisible: false,
          })
        );
      }
      lines.get(key).setData(movingAverage(kind, period, lastBars));
    }
    document.querySelectorAll('[data-ind]').forEach((btn) => {
      btn.classList.toggle('is-on', active.has(btn.getAttribute('data-ind')));
    });
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
    const candles = bars.map((bar) => ({
      time: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
    }));
    const volume = bars.map((bar) => ({
      time: bar.t,
      value: Number(bar.v) > 0 ? bar.v : 0,
      color: bar.c >= bar.o ? 'rgba(45, 106, 50, 0.45)' : 'rgba(179, 38, 30, 0.45)',
    }));
    agoByTime.clear();
    for (const bar of bars) agoByTime.set(bar.t, bar.ago);
    candleSeries.setData(candles);
    volumeSeries.setData(volume);
    barCount = candles.length;
    lastBars = bars;
    drawIndicators();
    fitView();
  }


  // ---- list, filters, heatmap
  // shortcut: the whole snapshot is filtered and paged here; past about 5,000 listings move it to /api/market/search.
  function changeOf(quote) {
    return quote.changes?.[HEAT_SCALE[windowKey] ? windowKey : '1Y'] ?? 0;
  }

  function fmtChange(n) {
    return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;
  }

  function filtered() {
    const rows = filterQuotes(quotes, view);
    const by = {
      cap: (a, b) => (b.cap ?? Infinity) - (a.cap ?? Infinity),
      change: (a, b) => changeOf(b) - changeOf(a),
      price: (a, b) => Number(b.price) - Number(a.price),
      volume: (a, b) => b.vol - a.vol,
      ticker: (a, b) => a.ticker.localeCompare(b.ticker),
    }[view.sort];
    return rows.sort((a, b) => by(a, b) || a.ticker.localeCompare(b.ticker));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderList(rows) {
    const host = document.getElementById('market-rows');
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    view.page = Math.min(view.page, pages - 1);
    const slice = rows.slice(view.page * PAGE_SIZE, (view.page + 1) * PAGE_SIZE);
    host.replaceChildren(
      ...slice.map((quote) => {
        const row = el('a', `quote-row${quote.ticker === ticker ? ' is-on' : ''}`);
        row.href = `/market?ticker=${encodeURIComponent(quote.ticker)}`;
        row.dataset.ticker = quote.ticker;
        const name = el('span', 'quote-name', quote.name);
        const detail = quote.focus || quote.sector;
        if (detail) name.append(el('span', 'quote-mix', detail));
        const change = changeOf(quote);
        row.append(
          el('span', 'quote-sym', quote.ticker),
          name,
          el('span', 'quote-px', quote.price),
          el('span', `quote-chg ${change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}`, fmtChange(change))
        );
        return row;
      })
    );
    document.getElementById('market-empty').hidden = rows.length > 0;
    document.getElementById('market-pager').hidden = pages < 2;
    document.getElementById('market-page').textContent = `${view.page + 1} / ${pages}`;
  }

  // Squarified treemap: lays items (value > 0) into a rectangle, biggest first, keeping tiles near square.
  function squarify(items, x, y, w, h) {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total || w <= 0 || h <= 0) return [];
    const nodes = [...items]
      .sort((a, b) => b.value - a.value)
      .map((item) => ({ item, area: (item.value * w * h) / total }));
    const out = [];
    let rect = { x, y, w, h };
    let row = [];
    const sum = (list) => list.reduce((acc, n) => acc + n.area, 0);
    const worst = (list, side) => {
      const s = sum(list);
      return Math.max(
        (side * side * Math.max(...list.map((n) => n.area))) / (s * s),
        (s * s) / (side * side * Math.min(...list.map((n) => n.area)))
      );
    };
    const place = () => {
      const s = sum(row);
      if (rect.w >= rect.h) {
        const cw = s / rect.h;
        let cy = rect.y;
        for (const n of row) {
          out.push({ item: n.item, x: rect.x, y: cy, w: cw, h: n.area / cw });
          cy += n.area / cw;
        }
        rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
      } else {
        const rh = s / rect.w;
        let cx = rect.x;
        for (const n of row) {
          out.push({ item: n.item, x: cx, y: rect.y, w: n.area / rh, h: rh });
          cx += n.area / rh;
        }
        rect = { x: rect.x, y: rect.y + rh, w: rect.w, h: rect.h - rh };
      }
      row = [];
    };
    for (const node of nodes) {
      const side = Math.min(rect.w, rect.h);
      if (row.length && worst([...row, node], side) > worst(row, side)) place();
      row.push(node);
    }
    if (row.length) place();
    return out;
  }

  function tileColor(change) {
    const scale = HEAT_SCALE[HEAT_SCALE[windowKey] ? windowKey : '1Y'];
    const strength = Math.min(Math.abs(change) / scale, 1);
    if (!strength) return 'var(--panel)';
    const side = change > 0 ? '--positive' : '--negative';
    return `color-mix(in srgb, var(${side}) ${Math.round(18 + strength * 62)}%, var(--panel))`;
  }

  function tile(rect, { ticker: symbol, change, label, dim }) {
    const node = el(symbol ? 'button' : 'div', `hm-tile${dim ? ' is-dim' : ''}`);
    node.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${Math.max(0, rect.w - 2)}px;height:${Math.max(0, rect.h - 2)}px;background:${tileColor(change)}`;
    if (symbol) {
      node.type = 'button';
      node.dataset.ticker = symbol;
      node.setAttribute('aria-label', `${label} ${fmtChange(change)}`);
    }
    if (rect.w > 40 && rect.h > 22) node.append(el('b', '', label));
    if (rect.w > 58 && rect.h > 38) node.append(el('span', '', fmtChange(change)));
    return node;
  }

  function tagLabel(tag) {
    const commodity = quotes.find((quote) => quote.type === 'commodity' && quote.ticker === tag);
    return (commodity ? commodity.name : tag).replaceAll('_', ' ');
  }

  // Businesses only, always the full set: the filter dims the map but never empties it, so a player can click out to another group.
  function renderHeatmap() {
    const map = document.getElementById('market-heatmap');
    const { width } = map.getBoundingClientRect();
    if (!width) return;
    const height = Math.round(Math.min(380, Math.max(240, width * 0.38)));
    map.style.height = `${height}px`;
    const nodes = [];
    const groups = heatGroups(quotes);
    const placed = squarify(
      [...groups].map(([key, group]) => ({ key, group, value: group.value })),
      0,
      0,
      width,
      height
    );
    for (const { item, x, y, w, h } of placed) {
      const head = w > 60 && h > 40 ? 15 : 0;
      if (head) {
        const tag = el('button', `hm-sector${view.tag === item.key ? ' is-on' : ''}`, tagLabel(item.key));
        tag.type = 'button';
        tag.dataset.tag = item.key;
        tag.style.cssText = `left:${x + 3}px;top:${y + 1}px;width:${Math.max(0, w - 6)}px`;
        nodes.push(tag);
      }
      const dim = Boolean(view.tag) && view.tag !== item.key;
      const inner = [...item.group.kept];
      if (item.group.rest.length) inner.push({ rest: item.group.rest, value: item.group.rest.reduce((sum, r) => sum + r.value, 0) });
      for (const t of squarify(inner, x, y + head, w, h - head)) {
        nodes.push(
          t.item.rest
            ? tile(t, {
                change: t.item.rest.reduce((sum, r) => sum + r.value * changeOf(r.quote), 0) / t.item.value,
                label: 'other',
                dim,
              })
            : tile(t, {
                ticker: t.item.quote.ticker,
                change: changeOf(t.item.quote),
                label: t.item.quote.ticker,
                dim,
              })
        );
      }
    }
    map.replaceChildren(...nodes);
  }

  // The search box, selects and chip all mirror `view`; every change goes through here.
  function syncControls() {
    const tags = tagList(quotes).sort((a, b) => tagLabel(a).localeCompare(tagLabel(b)));
    const select = document.getElementById('market-tag');
    if (select) {
      select.replaceChildren(
        ...[['', 'All focus'], ...tags.map((tag) => [tag, tagLabel(tag)])].map(([value, label]) => {
          const option = el('option', '', label);
          option.value = value;
          return option;
        })
      );
      select.value = view.tag;
    }
    const search = document.getElementById('market-search');
    if (search) search.value = view.q;
    const type = document.getElementById('market-type');
    if (type) type.value = view.type;
    const chip = document.getElementById('market-chip');
    if (chip) {
      chip.hidden = !view.tag;
      chip.textContent = view.tag ? `${tagLabel(view.tag)} ×` : '';
    }
  }

  function setTag(tag) {
    view.tag = view.tag === tag ? '' : tag;
    view.page = 0;
    syncControls();
    renderAll();
  }

  // A tile click selects the chart and brings its row into the list, dropping any filter that hides it.
  function reveal(symbol) {
    let rows = filtered();
    if (!rows.some((quote) => quote.ticker === symbol)) {
      Object.assign(view, { q: '', type: '', tag: '' });
      syncControls();
      rows = filtered();
    }
    view.page = Math.max(0, Math.floor(rows.findIndex((quote) => quote.ticker === symbol) / PAGE_SIZE));
    renderAll();
    if (wide.matches) {
      document.querySelector(`.quote-row[data-ticker="${symbol}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderAll() {
    renderList(filtered());
    renderHeatmap();
  }

  async function loadSnapshot() {
    const res = await fetch('/api/market/snapshot', { headers: { accept: 'application/json' } });
    if (!res.ok) return;
    quotes = (await res.json()).quotes || [];
    if (view.tag && !tagList(quotes).includes(view.tag)) view.tag = '';
    syncControls();
    renderAll();
    markSelected();
  }

  function setTicker(next) {
    const value = String(next || '').toUpperCase();
    if (!value || value === ticker) return;
    ticker = value;
    persistPrefs();
    markSelected();
    destroyChart();
    loadOhlc().catch(() => {});
    const url = `/market?ticker=${encodeURIComponent(ticker)}&window=${encodeURIComponent(windowKey)}`;
    history.replaceState(null, '', url);
  }

  function setWindow(next) {
    const value = normalizeWindow(next);
    if (value === windowKey) return;
    windowKey = value;
    persistPrefs();
    markSelected();
    renderAll();
    loadOhlc().catch(() => {});
    const url = ticker
      ? `/market?ticker=${encodeURIComponent(ticker)}&window=${encodeURIComponent(windowKey)}`
      : `/market?window=${encodeURIComponent(windowKey)}`;
    history.replaceState(null, '', url);
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

  document.querySelectorAll('.market-lists, #market-heatmap').forEach((area) =>
    area.addEventListener('click', (event) => {
      const row = event.target.closest('[data-ticker]');
      if (!row) return;
      event.preventDefault();
      setTicker(row.getAttribute('data-ticker'));
      if (!row.classList.contains('quote-row')) reveal(row.getAttribute('data-ticker'));
    })
  );

  document.querySelector('.market-screen')?.addEventListener('click', (event) => {
    const group = event.target.closest('[data-tag]');
    if (group) {
      event.preventDefault();
      setTag(group.getAttribute('data-tag'));
      return;
    }
    if (event.target.closest('#market-chip') || (view.tag && event.target.matches('.market-screen, .market-heatmap, .market-toolbar'))) {
      setTag(view.tag);
      return;
    }
    if (event.target.closest('[data-reset]')) {
      event.preventDefault();
      fitView();
      return;
    }
    const ind = event.target.closest('[data-ind]');
    if (ind) {
      const key = ind.getAttribute('data-ind');
      if (!active.delete(key)) active.add(key);
      drawIndicators();
      return;
    }
    const pager = event.target.closest('[data-page]');
    if (pager) {
      view.page = Math.max(0, view.page + Number(pager.getAttribute('data-page')));
      renderList(filtered());
      return;
    }
    const btn = event.target.closest('[data-window]');
    if (!btn) return;
    event.preventDefault();
    setWindow(btn.getAttribute('data-window'));
  });

  const controls = {
    'market-search': ['q', 'input'],
    'market-type': ['type', 'change'],
    'market-tag': ['tag', 'change'],
    'market-sort': ['sort', 'change'],
  };
  for (const [id, [key, type]] of Object.entries(controls)) {
    document.getElementById(id)?.addEventListener(type, (event) => {
      view[key] = event.target.value;
      view.page = 0;
      syncControls();
      renderAll();
    });
  }

  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      document.getElementById('market-search')?.focus();
    }
    if (event.key === 'Escape' && view.tag && event.target.tagName !== 'INPUT') setTag(view.tag);
  });

  const resize = new ResizeObserver(() => {
    if (chart) chart.applyOptions(chartSize());
  });
  resize.observe(host);
  const heat = document.getElementById('market-heatmap');
  if (heat) new ResizeObserver(() => quotes.length && renderHeatmap()).observe(heat);

  const themeWatch = new MutationObserver(() => applyTheme());
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  restorePrefs()
    .then(() => {
      if (ticker) {
        const url = `/market?ticker=${encodeURIComponent(ticker)}&window=${encodeURIComponent(windowKey)}`;
        history.replaceState(null, '', url);
      }
      persistPrefs();
      markSelected();
      loadSnapshot().catch(() => {});
      return loadOhlc();
    })
    .catch(() => {});
})();
