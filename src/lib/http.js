const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

export function isSingleIp(value) {
  const v = String(value || '').trim();
  if (!v || v.includes(',') || v.includes(' ')) return false;
  if (IPV4.test(v)) return true;
  return v.includes(':') && IPV6.test(v) && v.length <= 45;
}

export function clientIp(req) {
  const cf = req?.headers?.['cf-connecting-ip'];
  if (typeof cf === 'string' && isSingleIp(cf)) return cf.trim();
  const forwarded = req?.ip || req?.socket?.remoteAddress || '';
  return String(forwarded).replace(/^::ffff:/, '') || '0.0.0.0';
}

export function fetchWithTimeout(fetchImpl, url, opts = {}, ms = 8_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const extra = opts && typeof opts === 'object' ? opts : {};
  return Promise.resolve(fetchImpl(url, { ...extra, signal: ctrl.signal })).finally(() => {
    clearTimeout(timer);
  });
}

function parseHttpUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function isLoopbackHost(host) {
  const h = String(host || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '[::1]';
}

/** Live and legacy checkout hosts we operate. Never a wildcard. */
const TRUSTED_STORE_HOSTS = new Set([
  'disgrowth.net',
  'www.disgrowth.net',
  'disgrowth.vercel.app',
]);

export function isTrustedPaddleHttpUrl(value, storeOrigin = '') {
  const url = parseHttpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'paddle.com' || host.endsWith('.paddle.com')) {
    return url.protocol === 'https:';
  }
  if (url.protocol === 'https:' && TRUSTED_STORE_HOSTS.has(host)) {
    return true;
  }
  if (!storeOrigin) return false;
  try {
    const origin = new URL(storeOrigin);
    if (url.origin !== origin.origin) return false;
    if (origin.protocol === 'https:') return true;
    return origin.protocol === 'http:' && isLoopbackHost(origin.hostname);
  } catch {
    return false;
  }
}

export function csrfOriginOk(req, storeOrigin) {
  const header = req?.headers?.origin;
  if (!header) return true;
  try {
    const got = new URL(header);
    const want = new URL(storeOrigin);
    if (got.origin === want.origin) return true;
    return (
      isLoopbackHost(want.hostname) &&
      got.hostname === want.hostname &&
      got.protocol === want.protocol
    );
  } catch {
    return false;
  }
}

export function isDiscordInviteUrl(value) {
  const url = parseHttpUrl(value);
  if (!url || url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'discord.gg') return url.pathname.length > 1 && !url.pathname.includes('..');
  if (host === 'discord.com' || host === 'www.discord.com') {
    return url.pathname.startsWith('/invite/');
  }
  return false;
}
