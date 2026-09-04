import crypto from 'node:crypto';
import { sha256 } from './lib/security.js';

const COOKIE_DEV = 'mg_session';
const COOKIE_PROD = '__Host-mg_session';
const OAUTH_COOKIE = 'mg_oauth';

function cookieName(production) {
  return production ? COOKIE_PROD : COOKIE_DEV;
}

function keyFromSecret(secret) {
  return sha256(secret);
}

export function seal(obj, secret) {
  const iv = crypto.randomBytes(12);
  const key = keyFromSecret(secret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function unseal(token, secret) {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const key = keyFromSecret(secret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function serializeCookie(name, value, { maxAge, production, path = '/', httpOnly = true }) {
  const parts = [
    `${name}=${value}`,
    `Path=${path}`,
    'SameSite=Lax',
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  if (production) parts.push('Secure');
  return parts.join('; ');
}

export function readSession(req, config) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[cookieName(config.production)];
  const session = unseal(token, config.SESSION_SECRET);
  if (!session || !session.discordId) return null;
  return session;
}

export function setSessionCookie(res, session, config) {
  const maxAge = config.SESSION_DAYS * 24 * 60 * 60;
  const token = seal(session, config.SESSION_SECRET);
  const prev = res.getHeader('Set-Cookie');
  const cookie = serializeCookie(cookieName(config.production), token, {
    maxAge,
    production: config.production,
  });
  res.setHeader('Set-Cookie', appendCookie(prev, cookie));
}

export function clearSessionCookie(res, config) {
  const prev = res.getHeader('Set-Cookie');
  const cookie = serializeCookie(cookieName(config.production), '', {
    maxAge: 0,
    production: config.production,
  });
  res.setHeader('Set-Cookie', appendCookie(prev, cookie));
}

export function setOAuthCookie(res, payload, config) {
  const token = seal({ ...payload, exp: Date.now() + 10 * 60 * 1000 }, config.SESSION_SECRET);
  const prev = res.getHeader('Set-Cookie');
  const cookie = serializeCookie(OAUTH_COOKIE, token, {
    maxAge: 10 * 60,
    production: config.production,
  });
  res.setHeader('Set-Cookie', appendCookie(prev, cookie));
}

export function readOAuthCookie(req, config) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = unseal(cookies[OAUTH_COOKIE], config.SESSION_SECRET);
  if (!payload || payload.exp < Date.now()) return null;
  return payload;
}

export function clearOAuthCookie(res, config) {
  const prev = res.getHeader('Set-Cookie');
  const cookie = serializeCookie(OAUTH_COOKIE, '', {
    maxAge: 0,
    production: config.production,
  });
  res.setHeader('Set-Cookie', appendCookie(prev, cookie));
}

function appendCookie(prev, cookie) {
  if (!prev) return cookie;
  const list = Array.isArray(prev) ? prev : [prev];
  return [...list, cookie];
}

export function discordAvatarUrl(id, avatar) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`;
  try {
    const idx = Number(BigInt(id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}
