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

test('Paddle and Discord URLs cannot open-redirect off this store', async () => {
  const { csrfOriginOk, isDiscordInviteUrl, isTrustedPaddleHttpUrl } = await import('../src/lib/http.js');
  assert.equal(isTrustedPaddleHttpUrl('https://sandbox-buy.paddle.com/checkout/txn'), true);
  assert.equal(isTrustedPaddleHttpUrl('https://disgrowth.net/?_ptxn=txn'), true);
  assert.equal(isTrustedPaddleHttpUrl('https://disgrowth.vercel.app?_ptxn=txn'), true);
  assert.equal(isTrustedPaddleHttpUrl('https://evil.example/phish'), false);
  assert.equal(isTrustedPaddleHttpUrl('javascript:alert(1)'), false);
  assert.equal(isTrustedPaddleHttpUrl('http://sandbox-buy.paddle.com/x'), false);
  assert.equal(isTrustedPaddleHttpUrl('http://127.0.0.1/welcome', 'http://127.0.0.1'), true);
  assert.equal(isDiscordInviteUrl('https://discord.gg/XMadQ9tAd'), true);
  assert.equal(isDiscordInviteUrl('https://evil.example/invite'), false);
  assert.equal(csrfOriginOk({ headers: {} }, 'https://disgrowth.net'), true);
  assert.equal(
    csrfOriginOk({ headers: { origin: 'https://evil.example' } }, 'https://disgrowth.net'),
    false,
  );
  assert.equal(
    csrfOriginOk({ headers: { origin: 'https://disgrowth.net' } }, 'https://disgrowth.net'),
    true,
  );
});

test('clientIp ignores a spoofed CF-Connecting-IP header', async () => {
  const { clientIp } = await import('../src/lib/http.js');
  assert.equal(
    clientIp({
      ip: '127.0.0.1',
      headers: { 'cf-connecting-ip': '203.0.113.9' },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    '127.0.0.1',
  );
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
