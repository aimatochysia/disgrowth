(() => {
  // Skip the first-load screen once the backdrop art has been seen (it is cached by then).
  try {
    if (localStorage.getItem('art-seen')) document.documentElement.classList.add('art-ready');
  } catch {
    /* loader shows until the art is in */
  }
  const page = document.documentElement.dataset.page;
  if (page === 'store' || page === 'buy') {
    try {
      const stored = localStorage.getItem('mg-age');
      const cookie = document.cookie.split(';').some((part) => part.trim() === 'mg_age=yes');
      if (stored === 'yes' || cookie) document.documentElement.dataset.ageOk = 'yes';
      else if (stored === 'no') document.documentElement.dataset.ageOk = 'no';
    } catch {
      /* overlay stays up */
    }
  }
})();
