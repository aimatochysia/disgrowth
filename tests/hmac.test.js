import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyLemonSqueezySignature } from '../src/lib/security.js';

test('HMAC accept matching hex digest of raw body', () => {
  const secret = 'whsec_test';
  const raw = '{"meta":{"event_name":"order_created"}}';
  const header = createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyLemonSqueezySignature(raw, header, secret), true);
});

test('HMAC reject wrong secret, missing header, and length mismatch', () => {
  const secret = 'whsec_test';
  const raw = '{"ok":true}';
  const header = createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyLemonSqueezySignature(raw, header, 'other'), false);
  assert.equal(verifyLemonSqueezySignature(raw, null, secret), false);
  assert.equal(verifyLemonSqueezySignature(raw, 'ab', secret), false);
  assert.equal(verifyLemonSqueezySignature(raw, header, ''), false);
});
