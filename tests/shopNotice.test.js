import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SHOP_LOG_CHANNEL_ID,
  formatWebsiteShopNotice,
  notifyWebsitePayment,
  readBotToken,
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

test('only a gold payment is posted, and a missing token does not throw', async () => {
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
    env: { DISCORD_TOKEN: 'store-token', DISCORD_SHOP_LOG_CHANNEL_ID: SHOP_LOG_CHANNEL_ID },
    fetchImpl: async (url, init) => {
      calls.push({ url, body: init.body });
      return { ok: true };
    },
    log: { warn() {} },
  });
  assert.equal(posted.posted, true);
  assert.match(calls[0].url, new RegExp(`/channels/${SHOP_LOG_CHANNEL_ID}/messages$`));
  assert.match(calls[0].body, /result=granted/);
  assert.match(calls[0].body, /\[shop\] website /);
});

test('readBotToken prefers the env and does not require the bot file', () => {
  assert.equal(readBotToken({ DISCORD_TOKEN: 'from-env' }, () => {
    throw new Error('should not read');
  }), 'from-env');
  assert.equal(readBotToken({}, () => {
    throw new Error('missing');
  }), '');
});
