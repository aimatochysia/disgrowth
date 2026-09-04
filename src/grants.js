import { CATALOG, resolveSku } from './catalog.js';

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

const ACTIVE_STATUSES = new Set(['on_trial', 'active', 'past_due']);
const INACTIVE_STATUSES = new Set(['paused', 'unpaid', 'expired']);

export function extractVariantId(body) {
  const attrs = body?.data?.attributes || {};
  return attrs.variant_id ?? attrs.first_order_item?.variant_id ?? null;
}

export function extractDiscordId(body) {
  const custom = body?.meta?.custom_data || {};
  const id = custom.discord_id ?? custom.discordId;
  if (id == null || id === '') return '';
  return String(id);
}

export function extractStoreId(body) {
  const attrs = body?.data?.attributes || {};
  return attrs.store_id ?? null;
}

export function providerEventId(eventName, data) {
  return `${eventName}:${data?.id}`;
}

export function passExpiry(attributes, now = new Date()) {
  const ends = attributes?.ends_at ? new Date(attributes.ends_at) : null;
  const renews = attributes?.renews_at ? new Date(attributes.renews_at) : null;
  if (ends && !Number.isNaN(ends.getTime())) return ends;
  if (renews && !Number.isNaN(renews.getTime())) return renews;
  return new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);
}

export function passActiveFromStatus(status, attributes, now = new Date()) {
  const s = String(status || '').toLowerCase();
  if (ACTIVE_STATUSES.has(s)) return true;
  if (INACTIVE_STATUSES.has(s)) return false;
  if (s === 'cancelled') {
    const ends = attributes?.ends_at ? new Date(attributes.ends_at) : null;
    if (ends && ends.getTime() > now.getTime()) return true;
    return false;
  }
  return false;
}

function goldDeltaFor(sku, sign) {
  const item = CATALOG[sku];
  if (!item || item.kind !== 'one_time') return 0;
  return sign * item.gold;
}

/**
 * Pure interpreter: webhook JSON → intended ledger effect.
 * Does not talk to the database.
 */
export function interpretWebhook(body, ctx, now = new Date()) {
  const eventName = body?.meta?.event_name;
  const data = body?.data || {};
  const attrs = data.attributes || {};
  const custom = body?.meta?.custom_data || {};
  const storeId = extractStoreId(body);
  const variantId = extractVariantId(body);
  const discordId = extractDiscordId(body);

  if (!eventName || data.id == null) {
    return { ok: false, http: 400, reason: 'malformed' };
  }

  if (ctx.storeId && storeId != null && String(storeId) !== String(ctx.storeId)) {
    return { ok: false, http: 400, reason: 'store_id' };
  }

  const resolved = resolveSku({
    customSku: custom.sku_key,
    variantId,
    variantMap: ctx.variantMap || {},
  });

  if (!resolved.ok && resolved.reason === 'sku_mismatch') {
    return {
      ok: true,
      apply: false,
      effect: 'ignored',
      reason: 'sku_mismatch',
      providerEventId: providerEventId(eventName, data),
      eventName,
      discordId: discordId || 'unknown',
      skuKey: custom.sku_key || null,
      variantId: variantId == null ? null : String(variantId),
      lemonStoreId: storeId,
      lemonOrderId: orderIdOf(eventName, data, attrs),
      lemonSubscriptionId: subscriptionIdOf(eventName, data, attrs),
      goldDelta: 0,
    };
  }

  const skuKey = resolved.ok ? resolved.sku : null;
  const catalogItem = skuKey ? CATALOG[skuKey] : null;

  const base = {
    ok: true,
    apply: true,
    providerEventId: providerEventId(eventName, data),
    eventName,
    discordId,
    skuKey,
    variantId: variantId == null ? null : String(variantId),
    lemonStoreId: storeId,
    lemonOrderId: orderIdOf(eventName, data, attrs),
    lemonSubscriptionId: subscriptionIdOf(eventName, data, attrs),
    goldDelta: 0,
    subscriptionActive: undefined,
    expiresAt: undefined,
    reason: null,
  };

  if (!discordId) {
    return { ...base, apply: false, effect: 'ignored', reason: 'no_discord_id' };
  }

  switch (eventName) {
    case 'order_created': {
      if (!catalogItem) {
        return { ...base, apply: false, effect: 'ignored', reason: 'unknown_sku' };
      }
      if (catalogItem.kind === 'subscription') {
        return { ...base, apply: false, effect: 'ignored', reason: 'pass_order_wait_subscription' };
      }
      return { ...base, effect: 'gold_grant', goldDelta: goldDeltaFor(skuKey, 1) };
    }
    case 'order_refunded': {
      if (!catalogItem) {
        return { ...base, apply: false, effect: 'ignored', reason: 'unknown_sku' };
      }
      if (catalogItem.kind === 'subscription') {
        return {
          ...base,
          effect: 'pass_off',
          subscriptionActive: false,
          expiresAt: now,
        };
      }
      return { ...base, effect: 'gold_refund', goldDelta: goldDeltaFor(skuKey, -1) };
    }
    case 'subscription_created':
    case 'subscription_resumed':
    case 'subscription_unpaused':
    case 'subscription_payment_success':
    case 'subscription_payment_recovered': {
      return {
        ...base,
        effect: eventName === 'subscription_created' ? 'pass_on' : 'pass_sync',
        subscriptionActive: true,
        expiresAt: passExpiry(attrs, now),
      };
    }
    case 'subscription_updated': {
      const active = passActiveFromStatus(attrs.status, attrs, now);
      return {
        ...base,
        effect: 'pass_sync',
        subscriptionActive: active,
        expiresAt: active ? passExpiry(attrs, now) : (attrs.ends_at ? new Date(attrs.ends_at) : now),
      };
    }
    case 'subscription_cancelled': {
      const active = passActiveFromStatus('cancelled', attrs, now);
      return {
        ...base,
        effect: active ? 'pass_sync' : 'pass_off',
        subscriptionActive: active,
        expiresAt: attrs.ends_at ? new Date(attrs.ends_at) : now,
      };
    }
    case 'subscription_expired':
    case 'subscription_paused': {
      return {
        ...base,
        effect: 'pass_off',
        subscriptionActive: false,
        expiresAt: attrs.ends_at ? new Date(attrs.ends_at) : now,
      };
    }
    case 'subscription_payment_failed': {
      return { ...base, apply: false, effect: 'ignored', reason: 'payment_failed_wait_expiry' };
    }
    default:
      return { ...base, apply: false, effect: 'ignored', reason: 'unhandled_event' };
  }
}

function orderIdOf(eventName, data, attrs) {
  if (eventName.startsWith('order_')) return String(data.id);
  if (attrs.order_id) return String(attrs.order_id);
  return null;
}

function subscriptionIdOf(eventName, data, attrs) {
  if (eventName.startsWith('subscription')) return String(data.id);
  if (attrs.subscription_id) return String(attrs.subscription_id);
  return null;
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
}

export function writesCredits(sql) {
  return /update\s+players[\s\S]*\bcredits\s*=/i.test(sql);
}
