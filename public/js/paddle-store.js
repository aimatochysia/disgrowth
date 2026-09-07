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
  // Live defaults to production. Only set sandbox — go-live checklist says omit this call on live.
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

  function openCheckout(priceId, sku) {
    if (!priceId) return;
    const request = {
      items: [{ priceId, quantity: 1 }],
      settings: {
        displayMode: 'overlay',
        variant: 'one-page',
        successUrl: boot.successUrl,
      },
      customData: {},
    };
    if (boot.discordId) request.customData.discord_id = String(boot.discordId);
    if (sku) request.customData.sku_key = String(sku);
    if (boot.customerEmail) request.customer = { email: String(boot.customerEmail) };
    Paddle.Checkout.open(request);
  }

  const form = document.querySelector('[data-buy-form][data-paddle-overlay]');
  if (form) {
    form.addEventListener('submit', (event) => {
      const boxes = [...form.querySelectorAll('input[type="checkbox"][required]')];
      if (boxes.some((box) => !box.checked)) return;
      event.preventDefault();
      openCheckout(form.getAttribute('data-price-id'), form.getAttribute('data-sku'));
    });
  }
})();
