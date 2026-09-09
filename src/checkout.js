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
  const envOk = config.PADDLE_ENV === 'production' || config.PADDLE_ENV === 'sandbox';
  const canCharge = Boolean(config.PADDLE_CLIENT_TOKEN || config.PADDLE_API_KEY);
  return Boolean(envOk && canCharge && priceIdForSku(sku, config));
}

function checkoutPayload({ priceId, discordId, skuKey, successUrl, checkoutUrl }) {
  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: {
      discord_id: String(discordId),
      sku_key: skuKey,
    },
  };
  const checkout = {};
  if (checkoutUrl) checkout.url = String(checkoutUrl);
  if (successUrl) checkout.settings = { success_url: String(successUrl) };
  if (Object.keys(checkout).length) payload.checkout = checkout;
  return payload;
}

function unapprovedCheckoutUrl(detail) {
  return /does not contain a domain that has been approved/i.test(String(detail || ''));
}

export async function createPaddleCheckoutUrl({
  apiKey,
  apiBase,
  priceId,
  discordId,
  skuKey,
  successUrl,
  checkoutUrl,
  fetchImpl = fetch,
}) {
  async function post(payload) {
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

  const withOrigin = checkoutPayload({ priceId, discordId, skuKey, successUrl, checkoutUrl });
  try {
    return await post(withOrigin);
  } catch (err) {
    if (!checkoutUrl || !unapprovedCheckoutUrl(err.detail)) throw err;
    return post(checkoutPayload({ priceId, discordId, skuKey, successUrl, checkoutUrl: '' }));
  }
}

/** @deprecated use priceIdForSku */
export function variantIdForSku(sku, config) {
  return priceIdForSku(sku, config);
}
