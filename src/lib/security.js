import crypto from 'node:crypto';

const PADDLE_TS_MAX_AGE_SEC = 300;

export function verifyPaddleSignature(rawBody, header, secret, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = String(header).split(';');
  let ts = '';
  const signatures = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('ts=')) ts = trimmed.slice(3);
    if (trimmed.startsWith('h1=')) signatures.push(trimmed.slice(3));
  }
  if (!ts || !signatures.length) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const age = Math.abs(Math.floor(now / 1000) - tsNum);
  if (age > PADDLE_TS_MAX_AGE_SEC) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(ts).update(':').update(body).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  return signatures.some((sig) => {
    try {
      const got = Buffer.from(sig, 'hex');
      if (got.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(got, expectedBuf);
    } catch {
      return false;
    }
  });
}

export function safeNextPath(next, fallback = '/account') {
  if (next == null) return fallback;
  if (Array.isArray(next)) next = next[0];
  const value = String(next).trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('://')) return fallback;
  if (value.includes('\\')) return fallback;
  if (value.includes('\n') || value.includes('\r')) return fallback;
  if (value.includes('@')) return fallback;
  return value;
}

const REDACT_KEYS = new Set([
  'user_email',
  'email',
  'card_last_four',
  'card_brand',
  'ip_address',
  'ip',
  'first_name',
  'last_name',
  'tax_identifier',
  'billing_reason',
]);

export function redactPayload(input) {
  if (input == null) return input;
  if (Array.isArray(input)) return input.map(redactPayload);
  if (typeof input !== 'object') return input;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (REDACT_KEYS.has(key)) {
      out[key] = '[redacted]';
    } else {
      out[key] = redactPayload(value);
    }
  }
  return out;
}

export function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}
