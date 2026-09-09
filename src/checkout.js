import { CATALOG, isSku } from './catalog.js';
import { fetchWithTimeout, isTrustedPaddleHttpUrl } from './lib/http.js';
import { discordId as parseDiscordId } from './lib/validate.js';

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
      discord_id: parseDiscordId(discordId),
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
  const id = parseDiscordId(discordId);
  if (!id || !isSku(skuKey)) {
    throw new Error('paddle_checkout_invalid_custom_data');
  }
  async function post(payload) {
    const base = String(apiBase || '').replace(/\/$/, '');
    if (base !== 'https://api.paddle.com' && base !== 'https://sandbox-api.paddle.com') {
      throw new Error('paddle_api_base_invalid');
    }
    const res = await fetchWithTimeout(fetchImpl, `${base}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Paddle-Version': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 12_000);

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
    if (!isTrustedPaddleHttpUrl(url, checkoutUrl || successUrl)) {
      throw new Error('paddle_checkout_untrusted_url');
    }
    return url;
  }

  const withOrigin = checkoutPayload({ priceId, discordId: id, skuKey, successUrl, checkoutUrl });
  try {
    return await post(withOrigin);
  } catch (err) {
    if (!checkoutUrl || !unapprovedCheckoutUrl(err.detail)) throw err;
    return post(checkoutPayload({ priceId, discordId: id, skuKey, successUrl, checkoutUrl: '' }));
  }
}

/** @deprecated use priceIdForSku */
export function variantIdForSku(sku, config) {
  return priceIdForSku(sku, config);
}
