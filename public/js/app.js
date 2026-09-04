(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function currentTheme() {
    return root.dataset.theme === 'night' ? 'night' : 'day';
  }

  function syncToggle(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', theme === 'night' ? 'true' : 'false');
      const label = btn.querySelector('[data-theme-label]');
      if (label) label.textContent = theme === 'night' ? 'Night' : 'Daylight';
    });
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('mg-theme', theme);
    } catch {
      /* ignore */
    }
    syncToggle(theme);
  }

  function toggleTheme() {
    setTheme(currentTheme() === 'night' ? 'day' : 'night');
  }

  requestAnimationFrame(() => {
    root.classList.add('theme-animated');
    syncToggle(currentTheme());
  });

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-theme-toggle]');
    if (btn) toggleTheme();
  });

  const layers = [...document.querySelectorAll('[data-depth]')];
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  let scrollY = 0;

  function paint() {
    layers.forEach((el) => {
      const depth = Number(el.dataset.depth) || 0;
      const x = -cx * depth * 48;
      const y = -cy * depth * 28 + scrollY * depth * 0.12;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    });
  }

  function tick() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    paint();
    requestAnimationFrame(tick);
  }

  if (!reduce && layers.length) {
    window.addEventListener(
      'pointermove',
      (event) => {
        tx = event.clientX / window.innerWidth - 0.5;
        ty = event.clientY / window.innerHeight - 0.5;
      },
      { passive: true },
    );
    window.addEventListener(
      'scroll',
      () => {
        scrollY = window.scrollY || 0;
      },
      { passive: true },
    );
    requestAnimationFrame(tick);
  }

  const form = document.querySelector('[data-buy-form]');
  if (form) {
    const boxes = [...form.querySelectorAll('input[type="checkbox"][required]')];
    const submit = form.querySelector('button[type="submit"]');
    const sync = () => {
      if (!submit || submit.hasAttribute('data-locked')) return;
      submit.disabled = boxes.some((box) => !box.checked);
    };
    if (submit && !submit.disabled) {
      submit.disabled = true;
      boxes.forEach((box) => box.addEventListener('change', sync));
      sync();
    }
  }
})();
