import { CATALOG } from './catalog.js';
import { fetchWithTimeout, isTrustedPaddleHttpUrl } from './lib/http.js';

export function priceIdForSku(sku, config) {
  const item = CATALOG[sku];
  if (!item) return '';
  return config[item.variantEnv] || '';
}

export function checkoutConfigured(config, sku) {
  const envOk = config.PADDLE_ENV === 'production' || config.PADDLE_ENV === 'sandbox';
  return Boolean(envOk && config.PADDLE_API_KEY && priceIdForSku(sku, config));
}

function checkoutPayload({ priceId, successUrl, checkoutUrl }) {
  const payload = { items: [{ price_id: priceId, quantity: 1 }] };
  const checkout = {};
  if (checkoutUrl) checkout.url = String(checkoutUrl);
  if (successUrl) checkout.settings = { success_url: String(successUrl) };
  if (Object.keys(checkout).length) payload.checkout = checkout;
  return payload;
}

function unapprovedCheckoutUrl(detail) {
  return /does not contain a domain that has been approved/i.test(String(detail || ''));
}

/** Creates the Paddle transaction; the caller records who it is for before handing it out. */
export async function createPaddleTransaction({
  apiKey,
  apiBase,
  priceId,
  successUrl,
  checkoutUrl,
  fetchImpl = fetch,
}) {
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
    const id = json?.data?.id;
    if (!url || !id) {
      throw new Error('paddle_checkout_missing_url');
    }
    if (!isTrustedPaddleHttpUrl(url, checkoutUrl || successUrl)) {
      throw new Error('paddle_checkout_untrusted_url');
    }
    return { id: String(id), url };
  }

  const withOrigin = checkoutPayload({ priceId, successUrl, checkoutUrl });
  try {
    return await post(withOrigin);
  } catch (err) {
    if (!checkoutUrl || !unapprovedCheckoutUrl(err.detail)) throw err;
    return post(checkoutPayload({ priceId, successUrl, checkoutUrl: '' }));
  }
}
