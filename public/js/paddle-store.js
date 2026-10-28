(() => {
  const node = document.getElementById('paddle-boot');
  if (!node || typeof window.Paddle === 'undefined') return;

  let boot;
  try {
    boot = JSON.parse(node.textContent || '{}');
  } catch {
    return;
  }

  const token = boot.clientToken;
  const env = boot.env;
  if (!token || (env !== 'production' && env !== 'sandbox')) return;

  const Paddle = window.Paddle;
  // Paddle.js targets production by default; only sandbox needs Environment.set.
  if (env === 'sandbox') {
    Paddle.Environment.set('sandbox');
  }
  Paddle.Initialize({ token });

  const catalog = Array.isArray(boot.catalog) ? boot.catalog : [];
  const items = catalog
    .filter((item) => item && item.priceId)
    .map((item) => ({ priceId: item.priceId, quantity: 1 }));

  function paintFormattedTotals(result) {
    const lines = result?.data?.details?.lineItems || [];
    for (const line of lines) {
      const priceId = line.price?.id;
      const formatted = line.formattedTotals?.total;
      if (!priceId || formatted == null || formatted === '') continue;
      document.querySelectorAll(`[data-paddle-price-id="${priceId}"]`).forEach((el) => {
        el.textContent = formatted;
      });
    }
  }

  if (items.length) {
    const preview = { items };
    if (boot.country) {
      preview.address = { countryCode: boot.country };
    }
    Paddle.PricePreview(preview).then(paintFormattedTotals).catch((err) => {
      console.error('[store] price preview', err);
    });
  }

  // The server creates the transaction for the logged-in player; the page only opens it by id.
  async function openCheckout(form) {
    const res = await fetch(form.action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)),
    });
    const { transactionId } = await res.json();
    if (!res.ok || !transactionId) throw new Error('no_transaction');
    Paddle.Checkout.open({
      transactionId,
      settings: { displayMode: 'overlay', variant: 'one-page', successUrl: boot.successUrl },
    });
  }

  const form = document.querySelector('[data-buy-form][data-paddle-overlay]');
  if (form) {
    let busy = false;
    form.addEventListener('submit', (event) => {
      if (busy) {
        event.preventDefault();
        return;
      }
      const boxes = [...form.querySelectorAll('input[type="checkbox"][required]')];
      if (boxes.some((box) => !box.checked)) return;
      event.preventDefault();
      busy = true;
      // On any failure, submit normally so the server shows its message or redirects to hosted checkout.
      openCheckout(form).then(() => { busy = false; }).catch((err) => {
        console.error('[store] overlay checkout', err);
        form.submit();
      });
    });
  }
})();
