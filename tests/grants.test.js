import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GOLD_GRANT_SQL,
  GOLD_REFUND_SQL,
  interpretWebhook,
  passActiveFromStatus,
  writesCredits,
} from '../src/grants.js';

const variantMap = {
  'gold-starter': '111',
  'gold-pack': '222',
  'accountant-pass': '333',
};

function body({ event, id = '9', attrs = {}, custom = {} }) {
  return {
    meta: { event_name: event, custom_data: custom },
    data: { id, attributes: attrs },
  };
}

test('order_created gold-starter grants 500 from catalog, not payload amount', () => {
  const result = interpretWebhook(
    body({
      event: 'order_created',
      attrs: { store_id: 1, first_order_item: { variant_id: 111 } },
      custom: { discord_id: '99', sku_key: 'gold-starter' },
    }),
    { storeId: '1', variantMap },
  );
  assert.equal(result.effect, 'gold_grant');
  assert.equal(result.goldDelta, 500);
  assert.equal(result.apply, true);
});

test('variant and custom sku disagreement does not grant', () => {
  const result = interpretWebhook(
    body({
      event: 'order_created',
      attrs: { store_id: 1, first_order_item: { variant_id: 111 } },
      custom: { discord_id: '99', sku_key: 'gold-pack' },
    }),
    { storeId: '1', variantMap },
  );
  assert.equal(result.effect, 'ignored');
  assert.equal(result.reason, 'sku_mismatch');
  assert.equal(result.apply, false);
  assert.equal(result.goldDelta, 0);
});

test('order_created for pass is ignored (wait for subscription event)', () => {
  const result = interpretWebhook(
    body({
      event: 'order_created',
      attrs: { store_id: 1, first_order_item: { variant_id: 333 } },
      custom: { discord_id: '99', sku_key: 'accountant-pass' },
    }),
    { storeId: '1', variantMap },
  );
  assert.equal(result.effect, 'ignored');
  assert.equal(result.goldDelta, 0);
});

test('gold refund delta is negative catalog amount', () => {
  const result = interpretWebhook(
    body({
      event: 'order_refunded',
      attrs: { store_id: 1, first_order_item: { variant_id: 222 } },
      custom: { discord_id: '99', sku_key: 'gold-pack' },
    }),
    { storeId: '1', variantMap },
  );
  assert.equal(result.effect, 'gold_refund');
  assert.equal(result.goldDelta, -1600);
});

test('wrong store_id is rejected', () => {
  const result = interpretWebhook(
    body({
      event: 'order_created',
      attrs: { store_id: 2, first_order_item: { variant_id: 111 } },
      custom: { discord_id: '99', sku_key: 'gold-starter' },
    }),
    { storeId: '1', variantMap },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'store_id');
});

test('pass status matrix', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');
  const future = { ends_at: '2026-07-01T00:00:00.000Z' };
  const past = { ends_at: '2026-05-01T00:00:00.000Z' };
  assert.equal(passActiveFromStatus('active', {}, now), true);
  assert.equal(passActiveFromStatus('on_trial', {}, now), true);
  assert.equal(passActiveFromStatus('past_due', {}, now), true);
  assert.equal(passActiveFromStatus('paused', {}, now), false);
  assert.equal(passActiveFromStatus('unpaid', {}, now), false);
  assert.equal(passActiveFromStatus('expired', {}, now), false);
  assert.equal(passActiveFromStatus('cancelled', future, now), true);
  assert.equal(passActiveFromStatus('cancelled', past, now), false);
  assert.equal(passActiveFromStatus('cancelled', {}, now), false);
});

test('cancelled with future ends_at stays on', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');
  const result = interpretWebhook(
    body({
      event: 'subscription_cancelled',
      attrs: {
        store_id: 1,
        variant_id: 333,
        status: 'cancelled',
        ends_at: '2026-07-01T00:00:00.000Z',
      },
      custom: { discord_id: '99', sku_key: 'accountant-pass' },
    }),
    { storeId: '1', variantMap },
    now,
  );
  assert.equal(result.subscriptionActive, true);
  assert.equal(result.effect, 'pass_sync');
});

test('grant SQL dual-writes gold_bars and marks and never writes credits', () => {
  assert.match(GOLD_GRANT_SQL, /gold_bars = gold_bars \+ \$1/);
  assert.match(GOLD_GRANT_SQL, /marks\s+= marks \+ \$1/);
  assert.match(GOLD_REFUND_SQL, /GREATEST\(0, gold_bars - \$1\)/);
  assert.equal(writesCredits(GOLD_GRANT_SQL), false);
  assert.equal(writesCredits(GOLD_REFUND_SQL), false);
});
