(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.site-header');
  const nav = document.getElementById('site-nav');
  const navBtn = document.querySelector('[data-nav-toggle]');
  const axis = document.querySelector('.celestial-axis');
  const COMPACT_AT = 28;

  function currentTheme() {
    return root.dataset.theme === 'night' ? 'night' : 'day';
  }

  let celestialAngle = currentTheme() === 'night' ? 180 : 0;

  function applyCelestialAngle() {
    const transform = `rotate(${celestialAngle}deg)`;
    if (axis) axis.style.transform = transform;
    document.querySelectorAll('.theme-toggle-face').forEach((el) => {
      el.style.transform = transform;
    });
  }

  applyCelestialAngle();

  function syncToggle(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', theme === 'night' ? 'true' : 'false');
      const label = btn.querySelector('[data-theme-label]');
      if (label) label.textContent = theme === 'night' ? 'Night' : 'Day';
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
    celestialAngle += 180;
    applyCelestialAngle();
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.add('theme-animated');
      syncToggle(currentTheme());
    });
  });

  function setNavOpen(open) {
    if (!nav || !navBtn) return;
    nav.classList.toggle('is-open', open);
    navBtn.classList.toggle('is-open', open);
    navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    navBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  function syncCompact() {
    if (!header) return;
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const compact = mobile || window.scrollY > COMPACT_AT;
    header.classList.toggle('is-compact', compact);
    if (!compact) setNavOpen(false);
  }

  syncCompact();
  window.addEventListener('scroll', syncCompact, { passive: true });
  window.addEventListener('resize', syncCompact);

  const toTop = document.querySelector('[data-to-top]');
  function syncToTop() {
    if (!toTop) return;
    const show = window.scrollY > 280;
    toTop.classList.toggle('is-visible', show);
    toTop.setAttribute('aria-hidden', show ? 'false' : 'true');
    toTop.tabIndex = show ? 0 : -1;
  }
  syncToTop();
  window.addEventListener('scroll', syncToTop, { passive: true });
  if (toTop) {
    toTop.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-theme-toggle]')) toggleTheme();
    const toggle = event.target.closest('[data-nav-toggle]');
    if (toggle) {
      setNavOpen(!nav.classList.contains('is-open'));
      return;
    }
    if (nav && nav.classList.contains('is-open') && !event.target.closest('#site-nav')) {
      setNavOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setNavOpen(false);
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

  const gate = document.querySelector('[data-age-gate]');
  if (gate) {
    const cookie = (value) => {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `mg_age=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    };
    gate.querySelector('[data-age-yes]')?.addEventListener('click', () => {
      try {
        localStorage.setItem('mg-age', 'yes');
      } catch {
        /* ignore */
      }
      cookie('yes');
      document.documentElement.dataset.ageOk = 'yes';
    });
    gate.querySelector('[data-age-no]')?.addEventListener('click', () => {
      try {
        localStorage.setItem('mg-age', 'no');
      } catch {
        /* ignore */
      }
      cookie('no');
      document.documentElement.dataset.ageOk = 'no';
    });
  }
})();
