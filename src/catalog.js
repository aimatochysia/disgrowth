// Gold amounts are authoritative here. Prices live on the Paddle price ids ($10 / $25 / $50 / $100).

/** Lifetime net Gold Bars granted (store_orders gold_grant minus refunds) to unlock Patron tier 1. */
export const PATRON_TIER1_LIFETIME_GOLD = 2600;

/** First Gold Bar purchase grants this many Bonds for a pack's listed Gold. Does not change gold_delta. */
export function firstPurchaseBondsForGold(gold) {
  return Math.max(0, Math.floor(Math.abs(Number(gold) || 0)));
}

export const CATALOG = {
  'gold-10': {
    sku_key: 'gold-10',
    label: 'Gold Bars — 500',
    kind: 'one_time',
    gold: 500,
    variantEnv: 'PADDLE_PRICE_GOLD_10',
    blurb: 'A first stack for when daily Bonds run short.',
  },
  'gold-25': {
    sku_key: 'gold-25',
    label: 'Gold Bars — 1,275',
    kind: 'one_time',
    gold: 1275,
    variantEnv: 'PADDLE_PRICE_GOLD_25',
    blurb: 'A larger stack. Includes a 2% bulk bonus.',
  },
  'gold-50': {
    sku_key: 'gold-50',
    label: 'Gold Bars — 2,600',
    kind: 'one_time',
    gold: 2600,
    variantEnv: 'PADDLE_PRICE_GOLD_50',
    blurb: 'A serious reserve. Includes a 4% bulk bonus.',
  },
  'gold-100': {
    sku_key: 'gold-100',
    label: 'Gold Bars — 5,250',
    kind: 'one_time',
    gold: 5250,
    variantEnv: 'PADDLE_PRICE_GOLD_100',
    blurb: 'Our largest stack. Includes a 5% bulk bonus.',
  },
};

export const SKU_KEYS = Object.freeze(Object.keys(CATALOG));

export function isSku(value) {
  return Object.prototype.hasOwnProperty.call(CATALOG, value);
}

export function formatQty(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

export function variantMapFromEnv(env) {
  return {
    'gold-10': env.PADDLE_PRICE_GOLD_10 || '',
    'gold-25': env.PADDLE_PRICE_GOLD_25 || '',
    'gold-50': env.PADDLE_PRICE_GOLD_50 || '',
    'gold-100': env.PADDLE_PRICE_GOLD_100 || '',
  };
}

export function skuFromVariantId(variantId, map) {
  if (variantId == null || variantId === '') return null;
  const id = String(variantId);
  for (const [sku, variant] of Object.entries(map)) {
    if (variant && String(variant) === id) return sku;
  }
  return null;
}

/**
 * Prefer custom sku when it matches the variant map.
 * If both present and they disagree, refuse to grant.
 */
export function resolveSku({ customSku, variantId, variantMap }) {
  const fromVariant = skuFromVariantId(variantId, variantMap);
  const fromCustom = customSku && isSku(customSku) ? customSku : null;

  if (fromCustom && fromVariant && fromCustom !== fromVariant) {
    return { ok: false, reason: 'sku_mismatch', sku: null, fromCustom, fromVariant };
  }
  const sku = fromCustom || fromVariant;
  if (!sku) return { ok: false, reason: 'unknown_sku', sku: null, fromCustom, fromVariant };
  return { ok: true, reason: null, sku, fromCustom, fromVariant };
}

/** @returns {{ sku: string, label: string, blurb: string, priceId: string }[]} */
export function catalogItemsFromConfig(config) {
  return SKU_KEYS.map((sku) => {
    const { label, blurb, variantEnv } = CATALOG[sku];
    return { sku, label, blurb, priceId: config[variantEnv] || '' };
  });
}
