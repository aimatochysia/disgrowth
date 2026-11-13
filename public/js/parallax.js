// Shows the backdrop once loaded and eases its layers layers toward the mouse. Touch screens get the CSS sway instead, and reduced motion gets neither.
(() => {
  if (!document.querySelector('.backdrop')) return;
  // Lift the loading screen once every layer is in (cached visits finish before it ever fades in).
  const layers = [...document.querySelectorAll('.backdrop .layer')];
  Promise.all(layers.map((img) => img.decode().catch(() => {}))).then(() => document.documentElement.classList.add('art-ready'));
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  const EASE = 0.015; // share of the remaining distance covered each frame
  const target = { x: 0, y: 0 };
  const now = { x: 0, y: 0 };
  let frame = 0;

  function step() {
    now.x += (target.x - now.x) * EASE;
    now.y += (target.y - now.y) * EASE;
    root.style.setProperty('--px', now.x.toFixed(4));
    root.style.setProperty('--py', now.y.toFixed(4));
    const moving = Math.abs(target.x - now.x) > 0.001 || Math.abs(target.y - now.y) > 0.001;
    frame = moving ? requestAnimationFrame(step) : 0;
  }

  window.addEventListener('pointermove', (event) => {
    target.x = (event.clientX / window.innerWidth) * 2 - 1;
    target.y = (event.clientY / window.innerHeight) * 2 - 1;
    if (!frame) frame = requestAnimationFrame(step);
  });
})();
