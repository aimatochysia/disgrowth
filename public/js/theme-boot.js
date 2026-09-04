(() => {
  try {
    const saved = localStorage.getItem('mg-theme');
    const theme =
      saved === 'day' || saved === 'night'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'night'
          : 'day';
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = 'day';
  }
})();
