import { CATALOG } from './catalog.js';

export function buildCheckoutUrl({ base, variantId, discordId, skuKey, origin }) {
  if (!base || !variantId) return null;
  const url = new URL(`${base.replace(/\/$/, '')}/${variantId}`);
  url.searchParams.set('checkout[custom][discord_id]', String(discordId));
  url.searchParams.set('checkout[custom][sku_key]', skuKey);
  url.searchParams.set('checkout[product_options][redirect_url]', `${origin.replace(/\/$/, '')}/success`);
  return url.toString();
}

export function variantIdForSku(sku, config) {
  const item = CATALOG[sku];
  if (!item) return '';
  return config[item.variantEnv] || '';
}

export function checkoutConfigured(config, sku) {
  return Boolean(config.LEMONSQUEEZY_CHECKOUT_BASE && variantIdForSku(sku, config));
}
