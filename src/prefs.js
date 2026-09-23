import { CHART_WINDOW_KEYS } from './market.js';
import { sanitizeTicker } from './ticker.js';

const WINDOW_ALIASES = Object.freeze({
  '6h': '1M',
  '24h': '1M',
  '7d': '6M',
  '1m': '1M',
  '6m': '6M',
  ytd: 'YTD',
  '5y': '5Y',
  all: 'ALL',
});

export function sanitizeMarketTicker(raw) {
  return sanitizeTicker(raw);
}

/** Empty string if missing or unknown — never defaults to 1M. */
export function sanitizeMarketWindow(raw) {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (CHART_WINDOW_KEYS.includes(key)) return key;
  const alias = WINDOW_ALIASES[key] || WINDOW_ALIASES[key.toLowerCase()];
  if (alias) return alias;
  const upper = key.toUpperCase();
  return CHART_WINDOW_KEYS.includes(upper) ? upper : '';
}

/** Display-only login snapshot. Never includes discordId, email, or tokens. */
export function publicLoginCache(user) {
  if (!user) return { loggedIn: false };
  return {
    loggedIn: true,
    username: String(user.username || '').slice(0, 64),
    globalName: String(user.globalName || user.username || '').slice(0, 64),
    avatar: user.avatar ? String(user.avatar).slice(0, 64) : null,
  };
}
