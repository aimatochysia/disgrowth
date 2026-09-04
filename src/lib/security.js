import crypto from 'node:crypto';

export function verifyLemonSqueezySignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const digestHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const signature = Buffer.from(String(header).trim(), 'hex');
  const hmac = Buffer.from(digestHex, 'hex');
  if (signature.length !== hmac.length) return false;
  return crypto.timingSafeEqual(hmac, signature);
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
