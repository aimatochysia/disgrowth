import { CATALOG } from './catalog.js';

export function paddleApiBase(envName) {
  return envName === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

export function priceIdForSku(sku, config) {
  const item = CATALOG[sku];
  if (!item) return '';
  return config[item.variantEnv] || '';
}

export function checkoutConfigured(config, sku) {
  return Boolean(
    config.PADDLE_API_KEY &&
      config.PADDLE_WEBHOOK_SECRET &&
      priceIdForSku(sku, config),
  );
}

export async function createPaddleCheckoutUrl({
  apiKey,
  apiBase,
  priceId,
  discordId,
  skuKey,
  successUrl,
  fetchImpl = fetch,
}) {
  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: {
      discord_id: String(discordId),
      sku_key: skuKey,
    },
  };
  if (successUrl) {
    payload.checkout = { settings: { success_url: String(successUrl) } };
  }

  const res = await fetchImpl(`${String(apiBase).replace(/\/$/, '')}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Paddle-Version': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`paddle_checkout_${res.status}`);
    err.detail = String(detail).slice(0, 400);
    throw err;
  }

  const json = await res.json();
  const url = json?.data?.checkout?.url;
  if (!url) {
    throw new Error('paddle_checkout_missing_url');
  }
  return url;
}

/** @deprecated use priceIdForSku */
export function variantIdForSku(sku, config) {
  return priceIdForSku(sku, config);
}
