import { randomToken, safeReturnPath } from './lib/security.js';
import { seal, unseal } from './session.js';

const OAUTH_STATE_MS = 10 * 60 * 1000;

export function authorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify email');
  url.searchParams.set('state', state);
  return url.toString();
}

export function encodeOAuthState(next, secret) {
  return seal(
    {
      r: safeReturnPath(next),
      n: randomToken(16),
      t: Date.now(),
    },
    secret,
  );
}

export function decodeOAuthState(state, secret) {
  const payload = unseal(firstState(state), secret);
  if (!payload || !payload.n || !payload.t) return null;
  if (Date.now() - Number(payload.t) > OAUTH_STATE_MS) return null;
  return { next: safeReturnPath(payload.r), nonce: payload.n };
}

function firstState(state) {
  if (Array.isArray(state)) state = state[0];
  return state == null ? '' : String(state);
}

export async function exchangeCode({ code, clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetchImpl('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Discord token exchange failed (${res.status})`);
    err.detail = text.slice(0, 200);
    throw err;
  }
  return res.json();
}

export async function fetchIdentify(accessToken, fetchImpl = fetch) {
  const res = await fetchImpl('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord identify failed (${res.status})`);
  }
  return res.json();
}

export function newOAuthState(next, secret) {
  return {
    state: encodeOAuthState(next, secret),
    next: safeReturnPath(next),
  };
}

export function sessionFromDiscordUser(user) {
  const email = user.email && String(user.email).includes('@') ? String(user.email) : '';
  return {
    discordId: String(user.id),
    username: user.username || '',
    globalName: user.global_name || user.username || '',
    avatar: user.avatar || null,
    email,
    createdAt: Date.now(),
  };
}
