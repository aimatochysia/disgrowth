import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatWebsiteShopNotice,
  notifyWebsitePayment,
  usdLabel,
} from '../src/shopNotice.js';

test('website payment line says whether the player was granted', () => {
  const interpretation = {
    discordId: '42',
    skuKey: 'gold-10',
    goldDelta: 500,
    eventName: 'transaction.completed',
    lemonOrderId: 'txn_1',
    amount: '1000',
    currency: 'USD',
    effect: 'gold_grant',
  };
  assert.equal(usdLabel(interpretation), '10.00');
  const granted = formatWebsiteShopNotice(interpretation, { applied: true, playerId: 7 });
  assert.match(granted, /\[shop\] website /);
  assert.match(granted, /gold=\+500 GL/);
  assert.match(granted, /result=granted/);
  assert.match(granted, /playerId=7/);
  const missing = formatWebsiteShopNotice(interpretation, { missingPlayer: true });
  assert.match(missing, /result=not_granted/);
  assert.match(missing, /playerId=—/);
});

test('only a gold payment is posted, and a missing webhook does not throw', async () => {
  const calls = [];
  const skipped = await notifyWebsitePayment({
    interpretation: { effect: 'ignored' },
    result: { ignored: true },
    env: {},
    fetchImpl: async () => {
      calls.push('no');
      return { ok: true };
    },
    log: { warn() {} },
  });
  assert.equal(skipped.reason, 'not_payment');

  const posted = await notifyWebsitePayment({
    interpretation: {
      effect: 'gold_grant',
      discordId: '9',
      skuKey: 'gold-25',
      goldDelta: 1400,
      eventName: 'transaction.completed',
      lemonOrderId: 'txn_2',
      amount: '2500',
      currency: 'USD',
    },
    result: { applied: true, playerId: 3 },
    env: { SHOP_LOG_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/abc' },
    fetchImpl: async (url, init) => {
      calls.push({ url, body: init.body });
      return { ok: true };
    },
    log: { warn() {} },
  });
  assert.equal(posted.posted, true);
  assert.equal(calls[0].url, 'https://discord.com/api/webhooks/1/abc');
  assert.match(calls[0].body, /result=granted/);
  assert.match(calls[0].body, /\[shop\] website /);
});

test('no webhook URL means nothing is posted', async () => {
  const none = await notifyWebsitePayment({
    interpretation: { effect: 'gold_grant' },
    result: {},
    env: {},
    fetchImpl: async () => assert.fail('should not post'),
    log: { warn() {} },
  });
  assert.equal(none.reason, 'no_webhook');
});
