import { interpretWebhook, applyInterpretation } from './grants.js';
import { redactPayload } from './lib/security.js';
import { variantMapFromEnv } from './catalog.js';
import { createPaddleSdk, unmarshalWebhook } from './paddle.js';

/** This website owns Paddle grants. The Discord bot must not also credit Gold Bars. */

export function webhookContext(config) {
  return {
    variantMap: variantMapFromEnv(config),
  };
}

const CUSTOMER_UPSERT_SQL = `
INSERT INTO customers (customer_id, email, discord_id, created_at, updated_at)
VALUES ($1, $2, $3, NOW(), NOW())
ON CONFLICT (customer_id) DO UPDATE SET
  email = CASE
    WHEN EXCLUDED.email = '' OR EXCLUDED.email = 'unknown@paddle.invalid'
    THEN customers.email
    ELSE EXCLUDED.email
  END,
  discord_id = COALESCE(NULLIF(EXCLUDED.discord_id, ''), customers.discord_id),
  updated_at = NOW()
`.trim();

const PURCHASE_UPSERT_SQL = `
INSERT INTO purchases (
  transaction_id, customer_id, product_id, status, amount, currency, discord_id, sku_key, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
)
ON CONFLICT (transaction_id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  product_id = COALESCE(NULLIF(EXCLUDED.product_id, ''), purchases.product_id),
  status = EXCLUDED.status,
  amount = COALESCE(NULLIF(EXCLUDED.amount, ''), purchases.amount),
  currency = COALESCE(NULLIF(EXCLUDED.currency, ''), purchases.currency),
  discord_id = COALESCE(NULLIF(EXCLUDED.discord_id, ''), purchases.discord_id),
  sku_key = COALESCE(NULLIF(EXCLUDED.sku_key, ''), purchases.sku_key),
  updated_at = NOW()
`.trim();

async function upsertCustomer(client, { customerId, email, discordId }) {
  if (!customerId) return;
  const safeEmail = email && String(email).includes('@') ? String(email) : 'unknown@paddle.invalid';
  await client.query(CUSTOMER_UPSERT_SQL, [
    customerId,
    safeEmail,
    discordId ? String(discordId) : null,
  ]);
}

async function upsertPurchase(client, interpretation) {
  if (!interpretation.lemonOrderId || !interpretation.customerId) return;
  await upsertCustomer(client, {
    customerId: interpretation.customerId,
    email: interpretation.email,
    discordId: interpretation.discordId && interpretation.discordId !== 'lookup' ? interpretation.discordId : '',
  });
  await client.query(PURCHASE_UPSERT_SQL, [
    interpretation.lemonOrderId,
    interpretation.customerId,
    interpretation.productId || 'unknown',
    interpretation.effect === 'gold_grant' ? 'completed' : 'completed',
    interpretation.amount || '0',
    interpretation.currency || 'USD',
    interpretation.discordId && interpretation.discordId !== 'lookup' ? interpretation.discordId : null,
    interpretation.skuKey || null,
  ]);
}

export async function handlePaddleWebhook({ rawBody, signature, config, db, log = console, paddle }) {
  if (!config.PADDLE_WEBHOOK_SECRET) {
    return { status: 503, body: { ok: false, error: 'webhook_unconfigured' } };
  }

  let payload;
  try {
    const sdk = paddle || createPaddleSdk(config);
    payload = await unmarshalWebhook({
      rawBody,
      signature,
      secret: config.PADDLE_WEBHOOK_SECRET,
      paddle: sdk,
    });
  } catch {
    return { status: 401, body: { ok: false, error: 'invalid_signature' } };
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
      if (interpretation.effect === 'customer_upsert') {
        await upsertCustomer(client, {
          customerId: interpretation.customerId,
          email: interpretation.email,
          discordId: interpretation.discordId,
        });
        return { customer: true };
      }

      if (interpretation.effect === 'ignored' && interpretation.reason === 'unhandled_event') {
        return { ignored: true, reason: interpretation.reason };
      }

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
            interpretation.discordId || '',
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

      if (interpretation.effect === 'gold_grant' || interpretation.effect === 'gold_refund') {
        try {
          await upsertPurchase(client, interpretation);
        } catch (err) {
          log.warn?.('[store] purchase mirror failed', err.message);
        }
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
