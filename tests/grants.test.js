import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GOLD_GRANT_SQL,
  GOLD_REFUND_SQL,
  PATRON_EXTEND_SQL,
  interpretWebhook,
  writesCredits,
} from '../src/grants.js';

const variantMap = {
  'gold-10': 'pri_gold_10',
  'gold-25': 'pri_gold_25',
  'gold-50': 'pri_gold_50',
  'gold-100': 'pri_gold_100',
};

function body({
  event = 'transaction.completed',
  id = 'txn_9',
  eventId = 'evt_9',
  custom = {},
  priceId = 'pri_gold_10',
  extra = {},
} = {}) {
  return {
    event_id: eventId,
    event_type: event,
    occurred_at: '2026-09-05T00:00:00Z',
    data: {
      id,
      custom_data: custom,
      items: [{ price: { id: priceId } }],
      ...extra,
    },
  };
}

test('transaction.completed gold-10 grants 500 from catalog, not payload amount', () => {
  const result = interpretWebhook(
    body({
      custom: { discord_id: '99', sku_key: 'gold-10' },
      priceId: 'pri_gold_10',
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'gold_grant');
  assert.equal(result.goldDelta, 500);
  assert.equal(result.patronDays, 0);
  assert.equal(result.apply, true);
});

test('transaction.completed gold-25 grants Gold Bars and Patron days', () => {
  const result = interpretWebhook(
    body({
      custom: { discord_id: '99', sku_key: 'gold-25' },
      priceId: 'pri_gold_25',
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'gold_grant');
  assert.equal(result.goldDelta, 1300);
  assert.equal(result.patronDays, 30);
});

test('variant and custom sku disagreement does not grant', () => {
  const result = interpretWebhook(
    body({
      custom: { discord_id: '99', sku_key: 'gold-25' },
      priceId: 'pri_gold_10',
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'ignored');
  assert.equal(result.reason, 'sku_mismatch');
  assert.equal(result.apply, false);
  assert.equal(result.goldDelta, 0);
});

test('transaction.completed for unknown pass sku is ignored', () => {
  const result = interpretWebhook(
    body({
      custom: { discord_id: '99', sku_key: 'accountant-pass' },
      priceId: 'pri_pass',
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'ignored');
  assert.equal(result.reason, 'unknown_sku');
  assert.equal(result.goldDelta, 0);
});

test('approved gold refund delta is negative catalog amount and does not take Patron', () => {
  const result = interpretWebhook(
    body({
      event: 'adjustment.updated',
      extra: { action: 'refund', status: 'approved', transaction_id: 'txn_9' },
      custom: { discord_id: '99', sku_key: 'gold-25' },
      priceId: 'pri_gold_25',
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'gold_refund');
  assert.equal(result.goldDelta, -1300);
  assert.equal(result.patronDays, 0);
});

test('refund without sku looks up the original transaction', () => {
  const result = interpretWebhook(
    body({
      event: 'adjustment.updated',
      extra: { action: 'refund', status: 'approved', transaction_id: 'txn_9' },
      custom: {},
      priceId: '',
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'gold_refund');
  assert.equal(result.lookupOrder, true);
  assert.equal(result.lemonOrderId, 'txn_9');
});

test('pending adjustment is ignored', () => {
  const result = interpretWebhook(
    body({
      event: 'adjustment.updated',
      extra: { action: 'refund', status: 'pending_approval', transaction_id: 'txn_9' },
      custom: { discord_id: '99', sku_key: 'gold-10' },
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'ignored');
  assert.equal(result.reason, 'adjustment_pending');
});

test('unhandled Paddle events are ignored', () => {
  const result = interpretWebhook(
    body({ event: 'transaction.updated', custom: { discord_id: '99', sku_key: 'gold-10' } }),
    { variantMap },
  );
  assert.equal(result.effect, 'ignored');
  assert.equal(result.reason, 'unhandled_event');
  assert.equal(result.apply, false);
});

test('grant SQL dual-writes gold_bars and marks and never writes credits', () => {
  assert.match(GOLD_GRANT_SQL, /gold_bars = gold_bars \+ \$1/);
  assert.match(GOLD_GRANT_SQL, /marks\s+= marks \+ \$1/);
  assert.match(GOLD_REFUND_SQL, /GREATEST\(0, gold_bars - \$1\)/);
  assert.match(PATRON_EXTEND_SQL, /subscription_active = TRUE/);
  assert.match(PATRON_EXTEND_SQL, /INTERVAL '1 day'/);
  assert.equal(writesCredits(GOLD_GRANT_SQL), false);
  assert.equal(writesCredits(GOLD_REFUND_SQL), false);
  assert.equal(writesCredits(PATRON_EXTEND_SQL), false);
});
