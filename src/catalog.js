/**
 * Pack sizes for launch. Operator retunes Gold amounts here and product names in Paddle.
 * Dollar prices stay on the Paddle price ids ($10 / $25 / $50 / $100).
 *
 * @typedef {object} CatalogItem
 * @property {string} name
 * @property {string} description
 * @property {string[]} features
 * @property {string} priceId
 */

/** Lifetime net Gold Bars granted (store_orders gold_grant minus refunds) to unlock Patron tier 1. */
export const PATRON_TIER1_LIFETIME_GOLD = 2600;

export const CATALOG = {
  'gold-10': {
    sku_key: 'gold-10',
    name: 'Gold Bars — 500',
    label: 'Gold Bars — 500',
    kind: 'one_time',
    gold: 500,
    usdPlaceholder: 10,
    variantEnv: 'PADDLE_PRICE_GOLD_10',
    ledger: 'GL-10',
    description: '500 Gold Bars for the premium wallet.',
    summary: '500 Gold Bars for the premium wallet.',
    blurb: 'A first stack for when the daily Bonds are not enough. Convert them in Discord with /shop.',
    features: [
      '500 Gold Bars (GL)',
      'Convert 1:1 to Bonds in Discord',
      'First purchase on this Discord account doubles the bars',
    ],
  },
  'gold-25': {
    sku_key: 'gold-25',
    name: 'Gold Bars — 1,275',
    label: 'Gold Bars — 1,275',
    kind: 'one_time',
    gold: 1275,
    usdPlaceholder: 25,
    variantEnv: 'PADDLE_PRICE_GOLD_25',
    ledger: 'GL-25',
    description: '1,275 Gold Bars. About 2% more bars per dollar than the $10 pack.',
    summary: '1,275 Gold Bars. Slight bulk vs the $10 pack.',
    blurb: 'A larger stack. About 2% more Gold Bars per dollar than the $10 pack. Convert them in Discord with /shop.',
    features: [
      '1,275 Gold Bars (GL)',
      '~2% bulk vs the $10 pack',
      'First purchase on this Discord account doubles the bars',
    ],
  },
  'gold-50': {
    sku_key: 'gold-50',
    name: 'Gold Bars — 2,600',
    label: 'Gold Bars — 2,600',
    kind: 'one_time',
    gold: 2600,
    usdPlaceholder: 50,
    variantEnv: 'PADDLE_PRICE_GOLD_50',
    ledger: 'GL-50',
    description: '2,600 Gold Bars. About 4% more bars per dollar than the $10 pack. Unlocks Patron tier 1.',
    summary: '2,600 Gold Bars. Unlocks Patron tier 1.',
    blurb: 'A serious reserve. About 4% more Gold Bars per dollar than the $10 pack. This amount of lifetime Gold Bars bought unlocks Patron tier 1.',
    features: [
      '2,600 Gold Bars (GL)',
      '~4% bulk vs the $10 pack',
      'Unlocks Patron tier 1 from lifetime Gold Bars bought',
      'First purchase on this Discord account doubles the bars',
    ],
  },
  'gold-100': {
    sku_key: 'gold-100',
    name: 'Gold Bars — 5,250',
    label: 'Gold Bars — 5,250',
    kind: 'one_time',
    gold: 5250,
    usdPlaceholder: 100,
    variantEnv: 'PADDLE_PRICE_GOLD_100',
    ledger: 'GL-100',
    description: '5,250 Gold Bars. 5% more bars per dollar than the $10 pack. Unlocks Patron tier 1.',
    summary: '5,250 Gold Bars. 5% bulk. Unlocks Patron tier 1.',
    blurb: 'The largest stack we sell. 5% more Gold Bars per dollar than the $10 pack. Unlocks Patron tier 1 from lifetime Gold Bars bought.',
    features: [
      '5,250 Gold Bars (GL)',
      '5% bulk vs the $10 pack',
      'Unlocks Patron tier 1 from lifetime Gold Bars bought',
      'First purchase on this Discord account doubles the bars',
    ],
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

/**
 * Catalog items with live Paddle price ids filled from env.
 * @returns {CatalogItem[]}
 */
export function catalogItemsFromConfig(config) {
  return SKU_KEYS.map((sku) => {
    const item = CATALOG[sku];
    return {
      name: item.name,
      description: item.description,
      features: item.features,
      priceId: config[item.variantEnv] || '',
      sku: item.sku_key,
      gold: item.gold,
    };
  });
}
