import crypto from 'node:crypto';
import { randomToken, sha256 } from './lib/security.js';
import { discordAvatar, discordId } from './lib/validate.js';

const COOKIE_DEV = 'mg_session';
const COOKIE_PROD = '__Host-mg_session';
const OAUTH_DEV = 'mg_oauth';
const OAUTH_PROD = '__Host-mg_oauth';

function cookieName(production) {
  return production ? COOKIE_PROD : COOKIE_DEV;
}

function oauthCookieName(production) {
  return production ? OAUTH_PROD : OAUTH_DEV;
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

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function idHash(token) {
  return sha256(token).toString('hex');
}

export function sessionToken(req, config) {
  const token = parseCookies(req.headers.cookie)[cookieName(config.production)];
  return TOKEN_RE.test(token || '') ? token : '';
}

/** The cookie is only a random id; the profile lives in the database and can be revoked. */
export async function startSession(db, res, user, config) {
  const token = randomToken(32);
  await db.createSession({
    idHash: idHash(token),
    discordId: user.discordId,
    username: user.username,
    globalName: user.globalName,
    avatar: user.avatar,
    email: user.email,
    expiresAt: new Date(user.exp),
  });
  const cookie = serializeCookie(cookieName(config.production), token, {
    maxAge: config.SESSION_DAYS * 24 * 60 * 60,
    production: config.production,
  });
  res.setHeader('Set-Cookie', appendCookie(res.getHeader('Set-Cookie'), cookie));
}

export async function readSession(db, token) {
  if (!db || !token) return null;
  const row = await db.findSession(idHash(token));
  if (!row || !discordId(row.discord_id)) return null;
  return {
    discordId: row.discord_id,
    username: row.username,
    globalName: row.global_name,
    avatar: row.avatar,
    email: row.email,
  };
}

export async function endSession(db, res, { token, discordId: everywhere }, config) {
  if (everywhere) await db?.deleteSessionsFor(everywhere);
  else if (token) await db?.deleteSession(idHash(token));
  const cookie = serializeCookie(cookieName(config.production), '', {
    maxAge: 0,
    production: config.production,
  });
  res.setHeader('Set-Cookie', appendCookie(res.getHeader('Set-Cookie'), cookie));
  res.setHeader('Clear-Site-Data', '"cache", "cookies"');
}

export function setOAuthCookie(res, payload, config) {
  const token = seal({ ...payload, exp: Date.now() + 10 * 60 * 1000 }, config.SESSION_SECRET);
  const prev = res.getHeader('Set-Cookie');
  const cookie = serializeCookie(oauthCookieName(config.production), token, {
    maxAge: 10 * 60,
    production: config.production,
  });
  res.setHeader('Set-Cookie', appendCookie(prev, cookie));
}

export function readOAuthCookie(req, config) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = unseal(cookies[oauthCookieName(config.production)], config.SESSION_SECRET);
  if (!payload || payload.exp < Date.now()) return null;
  return payload;
}

export function clearOAuthCookie(res, config) {
  const prev = res.getHeader('Set-Cookie');
  const cookie = serializeCookie(oauthCookieName(config.production), '', {
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
  const safeId = discordId(id);
  const safeAvatar = discordAvatar(avatar);
  if (safeId && safeAvatar) return `https://cdn.discordapp.com/avatars/${safeId}/${safeAvatar}.png?size=64`;
  try {
    const idx = Number(BigInt(safeId || '0') >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}
