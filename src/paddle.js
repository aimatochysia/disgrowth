import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { verifyPaddleSignature } from './lib/security.js';
import { isTrustedPaddleHttpUrl } from './lib/http.js';

export function paddleEnvValid(value) {
  return value === 'production' || value === 'sandbox';
}

export function createPaddleSdk(config) {
  if (!config?.PADDLE_API_KEY || !paddleEnvValid(config.PADDLE_ENV)) return null;
  const environment = config.PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox;
  return new Paddle(config.PADDLE_API_KEY, { environment });
}

/**
 * Verify a Paddle webhook delivery. Uses SDK unmarshal when a client exists;
 * otherwise the same ts/h1 HMAC the SDK uses. Never JSON.parse first.
 */
export async function unmarshalWebhook({ rawBody, signature, secret, paddle }) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const header = signature == null ? '' : String(signature);
  if (!secret || !header) {
    const err = new Error('invalid_signature');
    err.code = 'invalid_signature';
    throw err;
  }

  if (paddle?.webhooks?.unmarshal) {
    try {
      await paddle.webhooks.unmarshal(raw, secret, header);
      return JSON.parse(raw);
    } catch (err) {
      if (verifyPaddleSignature(rawBody, header, secret)) {
        return JSON.parse(raw);
      }
      err.code = err.code || 'invalid_signature';
      throw err;
    }
  }

  if (!verifyPaddleSignature(rawBody, header, secret)) {
    const err = new Error('invalid_signature');
    err.code = 'invalid_signature';
    throw err;
  }
  return JSON.parse(raw);
}

export async function createCustomerPortalUrl(paddle, customerId) {
  if (!paddle) throw new Error('paddle_unconfigured');
  const session = await paddle.customers.portalSessions.create(customerId);
  const url = session?.urls?.general?.overview;
  if (!url || !isTrustedPaddleHttpUrl(url)) {
    throw new Error('paddle_portal_untrusted_url');
  }
  return url;
}
