// Tend a plot: plant, then water once per stage, then harvest. Browser only, nothing is sent anywhere.
(() => {
  const toy = document.getElementById('crop-toy');
  if (!toy) return;
  const act = document.getElementById('crop-act');
  const note = document.getElementById('crop-note');
  const stages = Number(toy.dataset.stages) || 3;
  const text = [
    ['An empty plot. Plant a seed.', 'Plant a seed'],
    ['A sprout. Water it.', 'Water'],
    ['Growing. Water it again.', 'Water'],
    ['Ready. Harvest it!', 'Harvest'],
  ];
  let stage = 0;
  let harvested = 0;
  function show() {
    toy.querySelectorAll('[data-crop]').forEach((node) => {
      node.hidden = Number(node.dataset.crop) !== stage;
    });
    note.textContent = text[stage][0] + (harvested ? ` Harvested: ${harvested}.` : '');
    act.textContent = text[stage][1];
  }
  act.addEventListener('click', () => {
    if (stage === stages) {
      harvested += 1;
      stage = 0;
    } else {
      stage += 1;
    }
    show();
  });
  show();
})();
