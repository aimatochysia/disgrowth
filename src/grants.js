import { CATALOG, PATRON_TIER1_LIFETIME_GOLD, resolveSku } from './catalog.js';

export const GOLD_GRANT_SQL = `
UPDATE players
SET gold_bars = gold_bars + $1,
    marks     = marks + $1
WHERE id = $2
`.trim();

export const GOLD_REFUND_SQL = `
UPDATE players
SET gold_bars = GREATEST(0, gold_bars - $1),
    marks     = GREATEST(0, marks - $1)
WHERE id = $2
`.trim();

export const PASS_ON_SQL = `
UPDATE players
SET subscription_active = TRUE,
    subscription_expires_at = $1
WHERE id = $2
`.trim();

export const PASS_OFF_SQL = `
UPDATE players
SET subscription_active = FALSE,
    subscription_expires_at = COALESCE($1, NOW())
WHERE id = $2
`.trim();

/** Patron follows lifetime Gold Bars bought, not stacked calendar days. */
export const PATRON_SYNC_SQL = `
UPDATE players
SET subscription_active = $1,
    subscription_expires_at = NULL
WHERE id = $2
`.trim();

export const LIFETIME_GOLD_SQL = `
SELECT COALESCE(SUM(gold_delta), 0)::bigint AS lifetime
FROM store_orders
WHERE discord_id = $1
  AND provider = 'paddle'
  AND effect IN ('gold_grant', 'gold_refund')
`.trim();

export function patronActiveFromLifetime(lifetimeGold) {
  return Number(lifetimeGold) >= PATRON_TIER1_LIFETIME_GOLD;
}

export function extractPriceId(data) {
  return (
    data?.items?.[0]?.price?.id ||
    data?.items?.[0]?.price_id ||
    data?.details?.line_items?.[0]?.price_id ||
    null
  );
}

export function extractDiscordId(data) {
  const custom = data?.custom_data || {};
  const id = custom.discord_id ?? custom.discordId;
  if (id == null || id === '') return '';
  return String(id);
}

export function extractCustomerId(data) {
  const id = data?.customer_id || data?.customer?.id;
  if (id != null && id !== '') return String(id);
  if (String(data?.id || '').startsWith('ctm_')) return String(data.id);
  return '';
}

export function extractEmail(data) {
  const email = data?.email || data?.customer?.email;
  if (email == null || email === '') return '';
  return String(email);
}

export function extractProductId(data) {
  return String(
    data?.items?.[0]?.price?.product_id ||
      data?.items?.[0]?.product_id ||
      data?.details?.line_items?.[0]?.product?.id ||
      data?.details?.line_items?.[0]?.price?.product_id ||
      '',
  );
}

export function extractAmount(data) {
  const value = data?.details?.totals?.grand_total ?? data?.details?.totals?.total ?? '';
  return value == null ? '' : String(value);
}

export function extractCurrency(data) {
  return String(data?.currency_code || data?.details?.totals?.currency_code || '');
}

export function goldDeltaFor(sku, sign) {
  const item = CATALOG[sku];
  if (!item || item.kind !== 'one_time') return 0;
  return sign * item.gold;
}

/**
 * Pure interpreter: Paddle Billing webhook JSON → intended ledger effect.
 */
export function interpretWebhook(body, ctx) {
  const eventName = body?.event_type;
  const data = body?.data || {};
  const eventId = body?.event_id;
  const priceId = extractPriceId(data);
  const custom = data.custom_data || {};
  const discordId = extractDiscordId(data);

  if (!eventName || eventId == null) {
    return { ok: false, http: 400, reason: 'malformed' };
  }

  const resolved = resolveSku({
    customSku: custom.sku_key,
    variantId: priceId,
    variantMap: ctx.variantMap || {},
  });

  const base = {
    ok: true,
    apply: true,
    providerEventId: String(eventId),
    eventName,
    discordId,
    skuKey: resolved.ok ? resolved.sku : null,
    variantId: priceId == null ? null : String(priceId),
    lemonStoreId: null,
    lemonOrderId: data.id ? String(data.id) : null,
    lemonSubscriptionId: data.subscription_id ? String(data.subscription_id) : null,
    goldDelta: 0,
    patronDays: 0,
    lookupOrder: false,
    subscriptionActive: undefined,
    expiresAt: undefined,
    reason: null,
    customerId: extractCustomerId(data),
    email: extractEmail(data),
    productId: extractProductId(data),
    amount: extractAmount(data),
    currency: extractCurrency(data),
  };

  if (eventName === 'customer.created' || eventName === 'customer.updated') {
    if (!base.customerId) {
      return { ...base, apply: false, effect: 'ignored', reason: 'no_customer_id' };
    }
    return {
      ...base,
      apply: true,
      effect: 'customer_upsert',
      lemonOrderId: base.customerId,
      discordId: extractDiscordId(data) || (data.custom_data?.discord_id ? String(data.custom_data.discord_id) : ''),
    };
  }

  if (String(eventName).startsWith('subscription.')) {
    return { ...base, apply: false, effect: 'ignored', reason: 'unhandled_event' };
  }

  if (!resolved.ok && resolved.reason === 'sku_mismatch') {
    return {
      ...base,
      apply: false,
      effect: 'ignored',
      reason: 'sku_mismatch',
      skuKey: custom.sku_key || null,
      goldDelta: 0,
    };
  }

  const skuKey = resolved.ok ? resolved.sku : null;
  const catalogItem = skuKey ? CATALOG[skuKey] : null;

  switch (eventName) {
    case 'transaction.completed': {
      if (!discordId) {
        return { ...base, apply: false, effect: 'ignored', reason: 'no_discord_id' };
      }
      if (!catalogItem) {
        return { ...base, apply: false, effect: 'ignored', reason: 'unknown_sku' };
      }
      if (catalogItem.kind !== 'one_time') {
        return { ...base, apply: false, effect: 'ignored', reason: 'not_gold_sku' };
      }
      return {
        ...base,
        skuKey,
        effect: 'gold_grant',
        goldDelta: goldDeltaFor(skuKey, 1),
        lemonOrderId: String(data.id),
      };
    }
    case 'adjustment.updated': {
      const action = String(data.action || '').toLowerCase();
      const status = String(data.status || '').toLowerCase();
      if (action !== 'refund' && action !== 'chargeback') {
        return { ...base, apply: false, effect: 'ignored', reason: 'adjustment_not_refund' };
      }
      if (status !== 'approved') {
        return { ...base, apply: false, effect: 'ignored', reason: 'adjustment_pending' };
      }
      const transactionId = data.transaction_id ? String(data.transaction_id) : null;
      if (!transactionId) {
        return { ...base, apply: false, effect: 'ignored', reason: 'no_transaction_id' };
      }
      if (catalogItem && discordId) {
        return {
          ...base,
          skuKey,
          effect: 'gold_refund',
          goldDelta: goldDeltaFor(skuKey, -1),
          lemonOrderId: transactionId,
        };
      }
      return {
        ...base,
        apply: true,
        effect: 'gold_refund',
        lookupOrder: true,
        discordId: discordId || 'lookup',
        lemonOrderId: transactionId,
      };
    }
    default:
      return { ...base, apply: false, effect: 'ignored', reason: 'unhandled_event' };
  }
}

export async function syncPatronFromLifetime(client, { playerId, discordId }) {
  const { rows } = await client.query(LIFETIME_GOLD_SQL, [String(discordId)]);
  const lifetime = Number(rows[0]?.lifetime || 0);
  const active = patronActiveFromLifetime(lifetime);
  await client.query(PATRON_SYNC_SQL, [active, playerId]);
  return { lifetime, active };
}

export async function applyInterpretation(client, interpretation, player) {
  const goldAbs = Math.abs(interpretation.goldDelta || 0);
  if (interpretation.effect === 'gold_grant' && goldAbs) {
    await client.query(GOLD_GRANT_SQL, [goldAbs, player.id]);
  }
  if (interpretation.effect === 'gold_refund' && goldAbs) {
    await client.query(GOLD_REFUND_SQL, [goldAbs, player.id]);
  }
  if (
    interpretation.subscriptionActive === true &&
    (interpretation.effect === 'pass_on' || interpretation.effect === 'pass_sync')
  ) {
    await client.query(PASS_ON_SQL, [interpretation.expiresAt || null, player.id]);
  }
  if (interpretation.subscriptionActive === false) {
    await client.query(PASS_OFF_SQL, [interpretation.expiresAt || null, player.id]);
  }
  if (interpretation.effect === 'gold_grant' || interpretation.effect === 'gold_refund') {
    await syncPatronFromLifetime(client, {
      playerId: player.id,
      discordId: interpretation.discordId,
    });
  }
}

export function writesCredits(sql) {
  return /update\s+players[\s\S]*\bcredits\s*=/i.test(sql);
}
