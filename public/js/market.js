(() => {
  const bootEl = document.getElementById('market-boot');
  const host = document.getElementById('market-chart');
  const focus = document.getElementById('market-focus');
  if (!bootEl || !host) return;

  const WINDOWS = new Set(['1M', '6M', 'YTD', '5Y', 'ALL']);
  const ALIASES = { '6h': '1M', '24h': '1M', '7d': '6M' };

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
  let barCount = 0;

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
      barCount = 0;
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
    candleSeries.setData(candles);
    barCount = candles.length;
    fitView();
  }

  function setTicker(next) {
    const value = String(next || '').toUpperCase();
    if (!value || value === ticker) return;
    ticker = value;
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
    markSelected();
    loadOhlc().catch(() => {});
    const url = ticker
      ? `/market?ticker=${encodeURIComponent(ticker)}&window=${encodeURIComponent(windowKey)}`
      : `/market?window=${encodeURIComponent(windowKey)}`;
    history.replaceState(null, '', url);
  }

  document.querySelector('.market-lists')?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-ticker]');
    if (!row) return;
    event.preventDefault();
    setTicker(row.getAttribute('data-ticker'));
  });

  document.querySelector('.market-windows')?.addEventListener('click', (event) => {
    if (event.target.closest('[data-reset]')) {
      event.preventDefault();
      fitView();
      return;
    }
    const btn = event.target.closest('[data-window]');
    if (!btn) return;
    event.preventDefault();
    setWindow(btn.getAttribute('data-window'));
  });

  const resize = new ResizeObserver(() => {
    if (!chart) return;
    chart.applyOptions(chartSize());
  });
  resize.observe(host);

  const themeWatch = new MutationObserver(() => applyTheme());
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  markSelected();
  loadOhlc().catch(() => {});
})();
