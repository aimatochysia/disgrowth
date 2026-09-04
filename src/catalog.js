/** Placeholder USD and GL counts for launch. Operator retunes in Lemon Squeezy + env. */

export const CATALOG = {
  'gold-starter': {
    sku_key: 'gold-starter',
    label: 'Gold Bars — starter',
    kind: 'one_time',
    gold: 500,
    usdPlaceholder: 9.99,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_STARTER',
    ledger: 'GL-S',
    summary: '500 Gold Bars for the premium wallet. Convert 1:1 to Bonds in Discord with /shop.',
    blurb: 'A starter stack. Convert to Bonds in Discord when you need them.',
  },
  'gold-pack': {
    sku_key: 'gold-pack',
    label: 'Gold Bars — pack',
    kind: 'one_time',
    gold: 1600,
    usdPlaceholder: 24.99,
    variantEnv: 'LEMONSQUEEZY_VARIANT_GOLD_PACK',
    ledger: 'GL-P',
    summary: '1,600 Gold Bars. Same wallet, larger stack.',
    blurb: 'A larger stack for bigger spends after you convert to Bonds in Discord.',
  },
  'accountant-pass': {
    sku_key: 'accountant-pass',
    label: 'Accountant pass',
    kind: 'subscription',
    gold: 0,
    usdPlaceholder: 6.99,
    variantEnv: 'LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS',
    ledger: 'PASS',
    summary: 'Monthly. Extra daily Bonds and occasional hints in Discord while the pass is on.',
    blurb: '12 Bonds per in-game day instead of 5. Hints are imperfect, not always sent, and may pause if you have been away from the Discord server. Not a Gold Bars pack.',
  },
};

export const SKU_KEYS = Object.freeze(Object.keys(CATALOG));

export function isSku(value) {
  return Object.prototype.hasOwnProperty.call(CATALOG, value);
}

export function formatUsd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

export function formatQty(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

export function variantMapFromEnv(env) {
  return {
    'gold-starter': env.LEMONSQUEEZY_VARIANT_GOLD_STARTER || '',
    'gold-pack': env.LEMONSQUEEZY_VARIANT_GOLD_PACK || '',
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
