import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactPayload, safeNextPath } from '../src/lib/security.js';

test('next= open redirects are rejected', () => {
  assert.equal(safeNextPath('/buy/gold-starter'), '/buy/gold-starter');
  assert.equal(safeNextPath('/account'), '/account');
  assert.equal(safeNextPath('https://evil.example'), '/account');
  assert.equal(safeNextPath('//evil.example'), '/account');
  assert.equal(safeNextPath('/\\evil'), '/account');
  assert.equal(safeNextPath('https://example.com/buy/gold-starter'), '/account');
  assert.equal(safeNextPath('login'), '/account');
  assert.equal(safeNextPath(['/store', 'https://evil.example']), '/store');
});

test('webhook payload redacts email and card fields', () => {
  const out = redactPayload({
    data: {
      attributes: {
        user_email: 'a@b.c',
        first_order_item: { card_last_four: '4242' },
      },
    },
    nested: { email: 'x', keep: 1 },
  });
  assert.equal(out.data.attributes.user_email, '[redacted]');
  assert.equal(out.data.attributes.first_order_item.card_last_four, '[redacted]');
  assert.equal(out.nested.email, '[redacted]');
  assert.equal(out.nested.keep, 1);
});
