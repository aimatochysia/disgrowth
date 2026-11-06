(() => {
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
