import dotenv from 'dotenv';

dotenv.config();

const PLACEHOLDERS = new Set([
  '',
  '-',
  '—',
  'null',
  'undefined',
  'todo',
  'changeme',
  'change-me',
  'your-secret-here',
  'replace-me',
  'blank',
  'none',
  'n/a',
]);

export function trim(value) {
  return value == null ? '' : String(value).trim();
}

/** Empty, or a dashboard placeholder like "-", is treated as unset. */
export function real(value) {
  const v = trim(value);
  if (!v) return '';
  if (PLACEHOLDERS.has(v.toLowerCase())) return '';
  return v;
}

function requiredInProd(name, value, errors) {
  if (!value) errors.push(name);
}

/** Loopback hosts are fine on a laptop and unreachable from Vercel. */
export function databaseHost(databaseUrl) {
  const value = real(databaseUrl);
  if (!value) return '';
  try {
    return new URL(value.replace(/^postgres(ql)?:/i, 'http:')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isLoopbackHost(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '0.0.0.0';
}

export function loadConfig(env = process.env) {
  const NODE_ENV = real(env.NODE_ENV) || 'development';
  const production = NODE_ENV === 'production';
  const onVercel = Boolean(env.VERCEL);
  const errors = [];

  const STORE_ORIGIN = real(env.STORE_ORIGIN) || 'http://localhost:3000';
  const SESSION_SECRET = real(env.SESSION_SECRET);
  const SESSION_DAYS = Number(env.SESSION_DAYS) || 14;

  const DISCORD_CLIENT_ID = real(env.DISCORD_CLIENT_ID);
  const DISCORD_CLIENT_SECRET = real(env.DISCORD_CLIENT_SECRET);
  const rawDatabaseUrl = real(env.DATABASE_URL);
  const dbHost = databaseHost(rawDatabaseUrl);
  const loopbackDb = Boolean(rawDatabaseUrl && isLoopbackHost(dbHost));
  const DATABASE_URL = loopbackDb && (production || onVercel) ? '' : rawDatabaseUrl;
  const PADDLE_API_KEY = real(env.PADDLE_API_KEY);
  const PADDLE_WEBHOOK_SECRET = real(env.PADDLE_WEBHOOK_SECRET);
  const PADDLE_PRICE_GOLD_10 = real(env.PADDLE_PRICE_GOLD_10);
  const PADDLE_PRICE_GOLD_25 = real(env.PADDLE_PRICE_GOLD_25);
  const PADDLE_PRICE_GOLD_50 = real(env.PADDLE_PRICE_GOLD_50);
  const PADDLE_PRICE_GOLD_100 = real(env.PADDLE_PRICE_GOLD_100);
  const PADDLE_ENV = real(env.PADDLE_ENV) || (production ? 'production' : 'sandbox');

  if (production) {
    requiredInProd('SESSION_SECRET', SESSION_SECRET, errors);
    requiredInProd('DISCORD_CLIENT_ID', DISCORD_CLIENT_ID, errors);
    requiredInProd('DISCORD_CLIENT_SECRET', DISCORD_CLIENT_SECRET, errors);
    requiredInProd('DATABASE_URL', DATABASE_URL, errors);
    if (loopbackDb) {
      errors.push('DATABASE_URL (cannot be localhost/127.0.0.1 on Vercel)');
    }
  }

  if (SESSION_SECRET && SESSION_SECRET.length < 32 && production) {
    errors.push('SESSION_SECRET (must be 32+ characters)');
  }

  const OPERATOR_LEGAL_NAME = real(env.OPERATOR_LEGAL_NAME);
  const previewLegal = !OPERATOR_LEGAL_NAME;

  const config = {
    NODE_ENV,
    production,
    port: Number(env.PORT) || 3000,
    STORE_ORIGIN: STORE_ORIGIN.replace(/\/$/, ''),
    SESSION_SECRET: SESSION_SECRET || (production ? '' : 'dev-only-1insecure-session-secret-32ch'),
    SESSION_DAYS,
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI:
      real(env.DISCORD_REDIRECT_URI) || `${STORE_ORIGIN.replace(/\/$/, '')}/api/auth/discord/callback`,
    DATABASE_URL,
    PADDLE_API_KEY,
    PADDLE_WEBHOOK_SECRET,
    PADDLE_ENV,
    PADDLE_API_BASE: PADDLE_ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com',
    PADDLE_PRICE_GOLD_10,
    PADDLE_PRICE_GOLD_25,
    PADDLE_PRICE_GOLD_50,
    PADDLE_PRICE_GOLD_100,

    OPERATOR_LEGAL_NAME: OPERATOR_LEGAL_NAME || 'Kaelis Quinn',
    GOVERNING_LAW: real(env.GOVERNING_LAW) || 'Disputes arising out of these Terms, the Store, or the game will be resolved by binding, confidential arbitration conducted online in the English language, rather than in court. Conflict-of-law rules do not apply to the extent they would produce a different result. If you are a consumer, you may have non-waivable statutory rights to bring a claim in your local courts where you reside.',
    OPERATOR_CONTACT_EMAIL: real(env.OPERATOR_CONTACT_EMAIL) || 'kaelisquinn@gmail.com',
    SUPPORT_EMAIL: real(env.SUPPORT_EMAIL) || 'kaelisquinn@gmail.com',
    PRIVACY_EMAIL: real(env.PRIVACY_EMAIL) || 'kaelisquinn@gmail.com',
    DISCORD_SUPPORT_INVITE: real(env.DISCORD_SUPPORT_INVITE),
    DISCORD_COMMUNITY_INVITE: real(env.DISCORD_COMMUNITY_INVITE) || 'https://discord.gg/XMadQ9tAd',
    LOG_RETENTION_DAYS: Number(env.LOG_RETENTION_DAYS) || 90,
    SLA_DAYS: Number(env.SLA_DAYS) || 5,
    TRANSFER_MECHANISM: real(env.TRANSFER_MECHANISM) || 'hosting may process data outside your country',
    LEGAL_DATE: real(env.LEGAL_DATE) || '2026-09-04',
    previewLegal,

    checkoutReady: Boolean(
      PADDLE_API_KEY &&
        PADDLE_WEBHOOK_SECRET &&
        PADDLE_PRICE_GOLD_10 &&
        PADDLE_PRICE_GOLD_25 &&
        PADDLE_PRICE_GOLD_50 &&
        PADDLE_PRICE_GOLD_100,
    ),
    oauthReady: Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET),
    dbReady: Boolean(DATABASE_URL),
    webhookReady: Boolean(PADDLE_WEBHOOK_SECRET),
    bootErrors: production ? errors : [],
  };

  return config;
}

export const config = loadConfig();
