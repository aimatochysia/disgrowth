// Scroll-locked scenes: wheel, swipe, keys or dots move one scene at a time, fading through black.
// Landscape: the mouse shifts the layers a little (parallax). Portrait (phones): scrolling first pans the wide scene
// left to right, never to its cut edges, then moves on; tilting the phone shifts the layers. The cloud layers also
// drift (CSS). Without this script the scenes just stack and scroll.
(() => {
  const reel = document.getElementById('reel');
  if (!reel) return;
  const panels = [...reel.querySelectorAll('.panel-scene')];
  const dots = [...reel.querySelectorAll('[data-go]')];
  const fade = reel.querySelector('.reel-fade');
  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portrait = window.matchMedia('(orientation: portrait)');
  const FADE_MS = 450;
  const PAN = 40; // --pan runs -PAN..PAN, in percent of the hidden width each side of the middle
  const EDGE_MS = 400; // a pan must rest at its end this long before the same gesture moves on
  let index = 0;
  let busy = false;
  let pan = 0;
  let edgeAt = 0;

  root.classList.add('reel-on');
  panels.forEach((panel, i) => panel.toggleAttribute('inert', i !== 0));

  const clamp = (value, max) => Math.max(-max, Math.min(max, value));
  function setVar(name, value) {
    root.style.setProperty(name, value.toFixed(3));
  }
  function setPan(value) {
    const next = clamp(value, PAN);
    if (Math.abs(next) === PAN && Math.abs(pan) !== PAN) edgeAt = Date.now();
    pan = next;
    setVar('--pan', pan);
  }

  function show(next) {
    panels.forEach((panel, i) => {
      panel.classList.toggle('is-active', i === next);
      panel.toggleAttribute('inert', i !== next);
    });
    dots.forEach((dot, i) => (i === next ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));
    // A scene entered going down starts at its left; going back up, at its right.
    if (portrait.matches) setPan(next > index ? -PAN : PAN);
    edgeAt = 0;
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

  // Portrait: move the pan; past its end (after a short rest there) move to the next or previous scene.
  function scroll(delta) {
    if (!portrait.matches) return go(index + Math.sign(delta));
    const atEnd = delta > 0 ? pan >= PAN : pan <= -PAN;
    if (atEnd) {
      if (Date.now() - edgeAt > EDGE_MS) go(index + Math.sign(delta));
      return;
    }
    setPan(pan + delta);
  }

  window.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (Math.abs(event.deltaY) < 1) return;
    if (portrait.matches) scroll(event.deltaY * 0.05);
    else if (Math.abs(event.deltaY) > 8) go(index + Math.sign(event.deltaY));
  }, { passive: false });

  let startY = null;
  let lastY = null;
  window.addEventListener('touchstart', (event) => {
    startY = lastY = event.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', (event) => {
    if (lastY === null || event.target.closest('a, button')) return;
    event.preventDefault();
    const y = event.touches[0].clientY;
    if (portrait.matches) scroll(((lastY - y) * 100) / window.innerHeight);
    lastY = y;
  }, { passive: false });
  window.addEventListener('touchend', (event) => {
    if (startY === null) return;
    const dy = startY - event.changedTouches[0].clientY;
    startY = lastY = null;
    askTilt();
    if (!portrait.matches && Math.abs(dy) > 50) go(index + Math.sign(dy));
  }, { passive: true });

  window.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select')) return;
    const next = { ArrowDown: index + 1, PageDown: index + 1, ' ': index + 1, ArrowUp: index - 1, PageUp: index - 1, Home: 0, End: panels.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    go(next);
  });

  dots.forEach((dot) => dot.addEventListener('click', () => go(Number(dot.dataset.go))));

  portrait.addEventListener('change', () => setPan(portrait.matches ? -PAN : 0));
  if (portrait.matches) setPan(-PAN);

  if (calm) return;
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    setVar('--px', (event.clientX / window.innerWidth) * 2 - 1);
    setVar('--py', (event.clientY / window.innerHeight) * 2 - 1);
  });

  // Phone tilt drives the same shift as the mouse. iOS asks for permission, which needs a touch first.
  function onTilt(event) {
    if (!portrait.matches || event.gamma === null) return;
    setVar('--px', clamp(event.gamma / 25, 1));
    setVar('--py', clamp((event.beta - 50) / 25, 1));
  }
  let tiltAsked = false;
  function askTilt() {
    if (tiltAsked || typeof DeviceOrientationEvent === 'undefined') return;
    tiltAsked = true;
    const ask = DeviceOrientationEvent.requestPermission;
    if (typeof ask !== 'function') return;
    ask().then((state) => state === 'granted' && window.addEventListener('deviceorientation', onTilt)).catch(() => {});
  }
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', onTilt);
  }
})();
