/** Placeholder USD and GL counts for launch. Operator retunes in Lemon Squeezy + env. */

export const CATALOG = {
  'gold-10': {
    sku_key: 'gold-10',
    label: 'Gold Bars — 500',
    kind: 'one_time',
    gold: 500,
    usdPlaceholder: 10,
    patronDays: 0,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_10',
    ledger: 'GL-10',
    summary: '500 Gold Bars for the premium wallet.',
    blurb: 'A first stack for when the daily Bonds are not enough. Convert them in Discord with /shop.',
  },
  'gold-25': {
    sku_key: 'gold-25',
    label: 'Gold Bars — 1,300',
    kind: 'one_time',
    gold: 1300,
    usdPlaceholder: 25,
    patronDays: 30,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_25',
    ledger: 'GL-25',
    summary: '1,300 Gold Bars, plus 30 days of Patron.',
    blurb: 'A larger stack and 30 days of Patron: extra daily Bonds and occasional hints in Discord.',
  },
  'gold-50': {
    sku_key: 'gold-50',
    label: 'Gold Bars — 2,700',
    kind: 'one_time',
    gold: 2700,
    usdPlaceholder: 50,
    patronDays: 30,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_50',
    ledger: 'GL-50',
    summary: '2,700 Gold Bars, plus 30 days of Patron.',
    blurb: 'A serious reserve and 30 days of Patron. Slightly more Gold Bars per dollar than the smaller packs.',
  },
  'gold-100': {
    sku_key: 'gold-100',
    label: 'Gold Bars — 5,600',
    kind: 'one_time',
    gold: 5600,
    usdPlaceholder: 100,
    patronDays: 30,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_100',
    ledger: 'GL-100',
    summary: '5,600 Gold Bars, plus 30 days of Patron.',
    blurb: 'The largest stack we sell, with 30 days of Patron included. Best Gold Bars per dollar on the shelf.',
  },
};

export const SKU_KEYS = Object.freeze(Object.keys(CATALOG));

export function isSku(value) {
  return Object.prototype.hasOwnProperty.call(CATALOG, value);
}

export function formatUsd(n) {
  const whole = Number.isInteger(n);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatQty(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

export function variantMapFromEnv(env) {
  return {
    'gold-10': env.LEMONSQUEEZY_VARIANT_GOLD_10 || '',
    'gold-25': env.LEMONSQUEEZY_VARIANT_GOLD_25 || '',
    'gold-50': env.LEMONSQUEEZY_VARIANT_GOLD_50 || '',
    'gold-100': env.LEMONSQUEEZY_VARIANT_GOLD_100 || '',
    // Legacy Lemon subscription product — still honoured on webhooks, not sold here.
    'accountant-pass': env.LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS || '',
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
