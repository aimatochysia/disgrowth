import { interpretWebhook, applyInterpretation } from './grants.js';
import { redactPayload, verifyPaddleSignature } from './lib/security.js';
import { variantMapFromEnv } from './catalog.js';

export function webhookContext(config) {
  return {
    variantMap: variantMapFromEnv(config),
  };
}

export async function handlePaddleWebhook({ rawBody, signature, config, db, log = console }) {
  if (!config.PADDLE_WEBHOOK_SECRET) {
    return { status: 503, body: { ok: false, error: 'webhook_unconfigured' } };
  }

  if (!verifyPaddleSignature(rawBody, signature, config.PADDLE_WEBHOOK_SECRET)) {
    return { status: 401, body: { ok: false, error: 'invalid_signature' } };
  }

  let payload;
  try {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    payload = JSON.parse(text);
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
             'paddle', $1, $2, $3,
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

      if (interpretation.effect === 'gold_refund') {
        const prior = await client.query(
          `SELECT sku_key, discord_id, gold_delta, provider_event_id FROM store_orders
           WHERE provider = 'paddle'
             AND lemon_order_id = $1
             AND effect = 'gold_grant'
           ORDER BY id DESC
           LIMIT 1`,
          [interpretation.lemonOrderId],
        );
        const row = prior.rows[0];
        if (row?.sku_key && row?.discord_id) {
          interpretation.skuKey = row.sku_key;
          interpretation.discordId = String(row.discord_id);
          interpretation.goldDelta = -Math.abs(Number(row.gold_delta) || 0);
          interpretation.originalGrantEventId = row.provider_event_id;
        } else if (
          !interpretation.skuKey ||
          !interpretation.discordId ||
          interpretation.discordId === 'lookup'
        ) {
          await client.query(
            `UPDATE store_orders
             SET effect = 'ignored'
             WHERE provider = 'paddle' AND provider_event_id = $1`,
            [interpretation.providerEventId],
          );
          return { ignored: true, reason: 'refund_no_original' };
        }
        await client.query(
          `UPDATE store_orders
           SET sku_key = $1, discord_id = $2, gold_delta = $3
           WHERE provider = 'paddle' AND provider_event_id = $4`,
          [
            interpretation.skuKey,
            interpretation.discordId,
            interpretation.goldDelta,
            interpretation.providerEventId,
          ],
        );
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
           WHERE provider = 'paddle' AND provider_event_id = $1`,
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
         WHERE provider = 'paddle' AND provider_event_id = $2`,
        [player.id, interpretation.providerEventId],
      );

      if (interpretation.effect === 'gold_grant' && Number(interpretation.goldDelta) > 0) {
        const firstPurchase = await client.query(
          `INSERT INTO store_first_purchase (discord_id, provider_event_id)
           VALUES ($1, $2)
           ON CONFLICT (discord_id) DO NOTHING
           RETURNING discord_id`,
          [interpretation.discordId, interpretation.providerEventId],
        );
        if (firstPurchase.rowCount === 1) {
          interpretation.goldDelta *= 2;
          interpretation.firstPurchaseBonus = true;
          await client.query(
            `UPDATE store_orders
             SET gold_delta = $1
             WHERE provider = 'paddle' AND provider_event_id = $2`,
            [interpretation.goldDelta, interpretation.providerEventId],
          );
        }
      }

      await applyInterpretation(client, interpretation, player);

      if (interpretation.effect === 'gold_refund' && interpretation.originalGrantEventId) {
        await client.query(
          `DELETE FROM store_first_purchase
           WHERE discord_id = $1 AND provider_event_id = $2`,
          [interpretation.discordId, interpretation.originalGrantEventId],
        );
      }

      return {
        applied: true,
        effect: interpretation.effect,
        playerId: player.id,
        goldDelta: interpretation.goldDelta,
        firstPurchaseBonus: Boolean(interpretation.firstPurchaseBonus),
      };
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
