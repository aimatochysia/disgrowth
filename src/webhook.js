import { interpretWebhook, applyInterpretation } from './grants.js';
import { redactPayload, verifyLemonSqueezySignature } from './lib/security.js';
import { variantMapFromEnv } from './catalog.js';

export function webhookContext(config) {
  return {
    storeId: config.LEMONSQUEEZY_STORE_ID,
    variantMap: variantMapFromEnv(config),
  };
}

export async function handleLemonSqueezyWebhook({ rawBody, signature, config, db, log = console }) {
  if (!config.LEMONSQUEEZY_WEBHOOK_SECRET) {
    return { status: 503, body: { ok: false, error: 'webhook_unconfigured' } };
  }

  if (!verifyLemonSqueezySignature(rawBody, signature, config.LEMONSQUEEZY_WEBHOOK_SECRET)) {
    return { status: 401, body: { ok: false, error: 'invalid_signature' } };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: 'invalid_json' } };
  }

  const interpretation = interpretWebhook(payload, webhookContext(config));
  if (!interpretation.ok) {
    return { status: interpretation.http || 400, body: { ok: false, error: interpretation.reason } };
  }

  if (!db) {
    return { status: 503, body: { ok: false, error: 'database_unconfigured' } };
  }

  const redacted = redactPayload(payload);

  try {
    const result = await db.withTransaction(async (client) => {
      try {
        await client.query(
          `INSERT INTO store_orders (
             provider, provider_event_id, event_name, lemon_store_id,
             lemon_order_id, lemon_subscription_id, lemon_variant_id,
             sku_key, discord_id, player_id, effect, gold_delta, payload
           ) VALUES (
             'lemonsqueezy', $1, $2, $3,
             $4, $5, $6,
             $7, $8, NULL, $9, $10, $11::jsonb
           )`,
          [
            interpretation.providerEventId,
            interpretation.eventName,
            interpretation.lemonStoreId,
            interpretation.lemonOrderId,
            interpretation.lemonSubscriptionId,
            interpretation.variantId,
            interpretation.skuKey,
            interpretation.discordId,
            interpretation.effect,
            interpretation.goldDelta || 0,
            JSON.stringify(redacted),
          ],
        );
      } catch (err) {
        if (err.code === '23505') {
          return { duplicate: true };
        }
        throw err;
      }

      if (!interpretation.apply || interpretation.effect === 'ignored') {
        return { ignored: true, reason: interpretation.reason };
      }

      const locked = await client.query(
        `SELECT id, discord_id FROM players WHERE discord_id = $1 FOR UPDATE`,
        [interpretation.discordId],
      );
      const player = locked.rows[0];
      if (!player) {
        await client.query(
          `UPDATE store_orders
           SET effect = 'error_no_player', player_id = NULL
           WHERE provider = 'lemonsqueezy' AND provider_event_id = $1`,
          [interpretation.providerEventId],
        );
        log.warn?.('[store] webhook error_no_player', {
          event: interpretation.eventName,
          discord_id: interpretation.discordId,
          order: interpretation.lemonOrderId,
        });
        return { missingPlayer: true };
      }

      await client.query(
        `UPDATE store_orders SET player_id = $1
         WHERE provider = 'lemonsqueezy' AND provider_event_id = $2`,
        [player.id, interpretation.providerEventId],
      );

      await applyInterpretation(client, interpretation, player);
      return { applied: true, effect: interpretation.effect, playerId: player.id };
    });

    if (result?.duplicate) {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    return { status: 200, body: { ok: true, ...result } };
  } catch (err) {
    log.error?.('[store] webhook failed', err);
    return { status: 500, body: { ok: false, error: 'processing_failed' } };
  }
}
