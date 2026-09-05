import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyPaddleSignature } from '../src/lib/security.js';

function sign(raw, secret, ts) {
  return createHmac('sha256', secret).update(String(ts)).update(':').update(raw).digest('hex');
}

test('Paddle HMAC accepts matching ts+h1 of raw body', () => {
  const secret = 'pdl_ntfsec_test';
  const raw = '{"event_type":"transaction.completed"}';
  const ts = Math.floor(Date.now() / 1000);
  const header = `ts=${ts};h1=${sign(raw, secret, ts)}`;
  assert.equal(verifyPaddleSignature(raw, header, secret), true);
});

test('Paddle HMAC rejects wrong secret, missing header, stale ts, and length mismatch', () => {
  const secret = 'pdl_ntfsec_test';
  const raw = '{"ok":true}';
  const ts = Math.floor(Date.now() / 1000);
  const header = `ts=${ts};h1=${sign(raw, secret, ts)}`;
  assert.equal(verifyPaddleSignature(raw, header, 'other'), false);
  assert.equal(verifyPaddleSignature(raw, null, secret), false);
  assert.equal(verifyPaddleSignature(raw, 'ab', secret), false);
  assert.equal(verifyPaddleSignature(raw, header, ''), false);
  const stale = `ts=${ts - 400};h1=${sign(raw, secret, ts - 400)}`;
  assert.equal(verifyPaddleSignature(raw, stale, secret), false);
});
