// Scroll-locked scenes: wheel, swipe, keys or dots move one scene at a time, fading through black.
// The pointer shifts the layers a little (parallax). Without this script the scenes just stack and scroll.
(() => {
  const reel = document.getElementById('reel');
  if (!reel) return;
  const panels = [...reel.querySelectorAll('.panel-scene')];
  const dots = [...reel.querySelectorAll('[data-go]')];
  const fade = reel.querySelector('.reel-fade');
  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FADE_MS = 450;
  let index = 0;
  let busy = false;

  root.classList.add('reel-on');
  panels.forEach((panel, i) => panel.toggleAttribute('inert', i !== 0));

  function show(next) {
    panels.forEach((panel, i) => {
      panel.classList.toggle('is-active', i === next);
      panel.toggleAttribute('inert', i !== next);
    });
    dots.forEach((dot, i) => (i === next ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));
    index = next;
  }

  function go(next) {
    if (busy || next < 0 || next >= panels.length || next === index) return;
    if (calm) return show(next);
    busy = true;
    fade.classList.add('is-black');
    setTimeout(() => {
      show(next);
      fade.classList.remove('is-black');
      setTimeout(() => (busy = false), FADE_MS);
    }, FADE_MS);
  }

  window.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (Math.abs(event.deltaY) > 8) go(index + Math.sign(event.deltaY));
  }, { passive: false });

  let startY = null;
  window.addEventListener('touchstart', (event) => (startY = event.touches[0].clientY), { passive: true });
  window.addEventListener('touchend', (event) => {
    if (startY === null) return;
    const dy = startY - event.changedTouches[0].clientY;
    startY = null;
    if (Math.abs(dy) > 50) go(index + Math.sign(dy));
  }, { passive: true });

  window.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select')) return;
    const next = { ArrowDown: index + 1, PageDown: index + 1, ' ': index + 1, ArrowUp: index - 1, PageUp: index - 1, Home: 0, End: panels.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    go(next);
  });

  dots.forEach((dot) => dot.addEventListener('click', () => go(Number(dot.dataset.go))));

  if (!calm) {
    window.addEventListener('pointermove', (event) => {
      root.style.setProperty('--px', ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty('--py', ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
    });
  }
})();
