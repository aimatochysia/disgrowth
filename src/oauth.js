import { randomToken, safeNextPath } from './lib/security.js';

export function authorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify email');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
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

export function newOAuthState(next) {
  return {
    state: randomToken(24),
    next: safeNextPath(next, '/account'),
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
