/** Vercel / CDN sentinels that must never be sent to Paddle as a country code. */
const NOT_A_COUNTRY = new Set(['XX', 'ZZ', 'T1', 'A1', 'A2', 'O1']);

/**
 * ISO 3166-1 alpha-2 from the edge, or null.
 * Never returns an internal sentinel such as OTHERS — omit the field and let
 * Paddle.PricePreview auto-detect from the visitor IP.
 */
export function countryFromRequest(req) {
  const headers = req?.headers || {};
  const raw = headers['x-vercel-ip-country'] ?? headers['cf-ipcountry'] ?? '';
  const value = String(Array.isArray(raw) ? raw[0] : raw).trim().toUpperCase();
  if (value === 'OTHERS') return null;
  if (!/^[A-Z]{2}$/.test(value)) return null;
  if (NOT_A_COUNTRY.has(value)) return null;
  return value;
}
