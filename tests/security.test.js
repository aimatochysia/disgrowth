import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactPayload, safeNextPath, safeReturnPath } from '../src/lib/security.js';

test('next= open redirects are rejected', () => {
  assert.equal(safeNextPath('/buy/gold-10'), '/buy/gold-10');
  assert.equal(safeNextPath('/account'), '/account');
  assert.equal(safeNextPath('https://evil.example'), '/account');
  assert.equal(safeNextPath('//evil.example'), '/account');
  assert.equal(safeNextPath('/\\evil'), '/account');
  assert.equal(safeNextPath('https://example.com/buy/gold-10'), '/account');
  assert.equal(safeNextPath('login'), '/account');
  assert.equal(safeNextPath(['/store', 'https://evil.example']), '/store');
});

test('login return path never sends the player back to /login', () => {
  assert.equal(safeReturnPath('/buy/gold-10'), '/buy/gold-10');
  assert.equal(safeReturnPath('/store'), '/store');
  assert.equal(safeReturnPath(undefined), '/store');
  assert.equal(safeReturnPath('/login'), '/store');
  assert.equal(safeReturnPath('/login?error=oauth'), '/store');
  assert.equal(safeReturnPath('/logout'), '/store');
  assert.equal(safeReturnPath('/auth/discord'), '/store');
  assert.equal(safeReturnPath('/api/auth/discord/callback'), '/store');
  assert.equal(safeReturnPath('https://evil.example'), '/store');
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
