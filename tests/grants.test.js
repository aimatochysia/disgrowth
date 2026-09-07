import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PATRON_TIER1_LIFETIME_GOLD } from '../src/catalog.js';
import {
  GOLD_GRANT_SQL,
  GOLD_REFUND_SQL,
  PATRON_SYNC_SQL,
  interpretWebhook,
  patronActiveFromLifetime,
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
      items: [{ price: { id: priceId, product_id: 'pro_gold' } }],
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

test('transaction.completed gold-25 grants 1,275 Gold Bars and no stacked Patron days', () => {
  const result = interpretWebhook(
    body({
      custom: { discord_id: '99', sku_key: 'gold-25' },
      priceId: 'pri_gold_25',
    }),
    { variantMap },
  );
  assert.equal(result.effect, 'gold_grant');
  assert.equal(result.goldDelta, 1275);
  assert.equal(result.patronDays, 0);
});

test('transaction.completed gold-100 grants 5,250 Gold Bars', () => {
  const result = interpretWebhook(
    body({
      custom: { discord_id: '99', sku_key: 'gold-100' },
      priceId: 'pri_gold_100',
    }),
    { variantMap },
  );
  assert.equal(result.goldDelta, 5250);
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

test('approved gold refund delta is negative catalog amount', () => {
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
  assert.equal(result.goldDelta, -1275);
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

test('subscription events are ignored', () => {
  const result = interpretWebhook(
    body({ event: 'subscription.created', custom: { discord_id: '99' } }),
    { variantMap },
  );
  assert.equal(result.effect, 'ignored');
  assert.equal(result.reason, 'unhandled_event');
});

test('customer.created upserts without granting Gold Bars', () => {
  const result = interpretWebhook(
    {
      event_id: 'evt_ctm',
      event_type: 'customer.created',
      data: { id: 'ctm_1', email: 'a@b.c', custom_data: { discord_id: '99' } },
    },
    { variantMap },
  );
  assert.equal(result.effect, 'customer_upsert');
  assert.equal(result.customerId, 'ctm_1');
  assert.equal(result.email, 'a@b.c');
  assert.equal(result.goldDelta, 0);
});

test('Patron tier 1 unlocks at 2,600 lifetime Gold Bars bought', () => {
  assert.equal(PATRON_TIER1_LIFETIME_GOLD, 2600);
  assert.equal(patronActiveFromLifetime(2550), false);
  assert.equal(patronActiveFromLifetime(2599), false);
  assert.equal(patronActiveFromLifetime(2600), true);
  assert.equal(patronActiveFromLifetime(5250), true);
});

test('grant SQL dual-writes gold_bars and marks and never writes credits', () => {
  assert.match(GOLD_GRANT_SQL, /gold_bars = gold_bars \+ \$1/);
  assert.match(GOLD_GRANT_SQL, /marks\s+= marks \+ \$1/);
  assert.match(GOLD_REFUND_SQL, /GREATEST\(0, gold_bars - \$1\)/);
  assert.match(PATRON_SYNC_SQL, /subscription_active = \$1/);
  assert.doesNotMatch(PATRON_SYNC_SQL, /INTERVAL '1 day'/);
  assert.equal(writesCredits(GOLD_GRANT_SQL), false);
  assert.equal(writesCredits(GOLD_REFUND_SQL), false);
  assert.equal(writesCredits(PATRON_SYNC_SQL), false);
});
