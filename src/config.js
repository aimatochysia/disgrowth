import dotenv from 'dotenv';

dotenv.config();

function trim(value) {
  return value == null ? '' : String(value).trim();
}

function requiredInProd(name, value, errors) {
  if (!value) errors.push(name);
}

export function loadConfig(env = process.env) {
  const NODE_ENV = trim(env.NODE_ENV) || 'development';
  const production = NODE_ENV === 'production';
  const errors = [];

  const STORE_ORIGIN = trim(env.STORE_ORIGIN) || 'http://localhost:3000';
  const SESSION_SECRET = trim(env.SESSION_SECRET);
  const SESSION_DAYS = Number(env.SESSION_DAYS) || 14;

  if (production) {
    requiredInProd('SESSION_SECRET', SESSION_SECRET, errors);
    requiredInProd('DISCORD_CLIENT_ID', trim(env.DISCORD_CLIENT_ID), errors);
    requiredInProd('DISCORD_CLIENT_SECRET', trim(env.DISCORD_CLIENT_SECRET), errors);
    requiredInProd('DATABASE_URL', trim(env.DATABASE_URL), errors);
  }

  if (SESSION_SECRET && SESSION_SECRET.length < 32 && production) {
    errors.push('SESSION_SECRET (must be 32+ characters)');
  }

  const OPERATOR_LEGAL_NAME = trim(env.OPERATOR_LEGAL_NAME);
  const previewLegal = !OPERATOR_LEGAL_NAME;

  const config = {
    NODE_ENV,
    production,
    port: Number(env.PORT) || 3000,
    STORE_ORIGIN: STORE_ORIGIN.replace(/\/$/, ''),
    SESSION_SECRET: SESSION_SECRET || 'dev-only-1insecure-session-secret-32ch',
    SESSION_DAYS,
    DISCORD_CLIENT_ID: trim(env.DISCORD_CLIENT_ID),
    DISCORD_CLIENT_SECRET: trim(env.DISCORD_CLIENT_SECRET),
    DISCORD_REDIRECT_URI:
      trim(env.DISCORD_REDIRECT_URI) || `${STORE_ORIGIN.replace(/\/$/, '')}/api/auth/discord/callback`,
    DATABASE_URL: trim(env.DATABASE_URL),
    PADDLE_API_KEY: trim(env.PADDLE_API_KEY),
    PADDLE_WEBHOOK_SECRET: trim(env.PADDLE_WEBHOOK_SECRET),
    PADDLE_ENV: trim(env.PADDLE_ENV) || (production ? 'production' : 'sandbox'),
    PADDLE_API_BASE:
      (trim(env.PADDLE_ENV) || (production ? 'production' : 'sandbox')) === 'production'
        ? 'https://api.paddle.com'
        : 'https://sandbox-api.paddle.com',
    PADDLE_PRICE_GOLD_10: trim(env.PADDLE_PRICE_GOLD_10) || trim(env.PADDLE_PRICE_GOLD_STARTER),
    PADDLE_PRICE_GOLD_25: trim(env.PADDLE_PRICE_GOLD_25) || trim(env.PADDLE_PRICE_GOLD_PACK),
    PADDLE_PRICE_GOLD_50: trim(env.PADDLE_PRICE_GOLD_50),
    PADDLE_PRICE_GOLD_100: trim(env.PADDLE_PRICE_GOLD_100),

    // Legal & Operator Configuration
    OPERATOR_LEGAL_NAME: OPERATOR_LEGAL_NAME || 'Kaelis Quinn',
    OPERATOR_TRADING_NAME: trim(env.OPERATOR_TRADING_NAME) || 'Disgrowth',
    OPERATOR_REGISTERED_ADDRESS: trim(env.OPERATOR_REGISTERED_ADDRESS) || '[address not yet published]',
    OPERATOR_COUNTRY: trim(env.OPERATOR_COUNTRY) || 'USA',
    GOVERNING_LAW: trim(env.GOVERNING_LAW) || 'The laws of the State of Delaware, USA, excluding conflict-of-law rules, govern these Terms. Any dispute, claim, or controversy arising out of or relating to these Terms, the Store, or the game will be resolved by binding, confidential arbitration conducted online, rather than in court. The arbitration will be conducted in the English language. However, if you are a consumer, you may have non-waivable statutory rights to bring a claim in your local courts where you reside.',
    VENUE: trim(env.VENUE) || '[venue not yet published]',
    OPERATOR_CONTACT_EMAIL: trim(env.OPERATOR_CONTACT_EMAIL) || 'kaelisquinn@gmail.com',
    SUPPORT_EMAIL: trim(env.SUPPORT_EMAIL) || 'kaelisquinn@gmail.com',
    PRIVACY_EMAIL: trim(env.PRIVACY_EMAIL) || 'kaelisquinn@gmail.comm',
    DISCORD_SUPPORT_INVITE: trim(env.DISCORD_SUPPORT_INVITE),
    DISCORD_COMMUNITY_INVITE: trim(env.DISCORD_COMMUNITY_INVITE) || 'https://discord.gg/XMadQ9tAd',
    DISCORD_BOT_PUBLIC_URL: trim(env.DISCORD_BOT_PUBLIC_URL),
    LOG_RETENTION_DAYS: Number(env.LOG_RETENTION_DAYS) || 90,
    SLA_DAYS: Number(env.SLA_DAYS) || 5,
    TRANSFER_MECHANISM: trim(env.TRANSFER_MECHANISM) || 'hosting may process data outside your country',
    LEGAL_DATE: trim(env.LEGAL_DATE) || '2026-09-04',
    previewLegal,
    
    // System Readiness Flags
    checkoutReady: Boolean(
      trim(env.PADDLE_API_KEY) &&
        trim(env.PADDLE_WEBHOOK_SECRET) &&
        (trim(env.PADDLE_PRICE_GOLD_10) || trim(env.PADDLE_PRICE_GOLD_STARTER)) &&
        (trim(env.PADDLE_PRICE_GOLD_25) || trim(env.PADDLE_PRICE_GOLD_PACK)) &&
        trim(env.PADDLE_PRICE_GOLD_50) &&
        trim(env.PADDLE_PRICE_GOLD_100),
    ),
    oauthReady: Boolean(trim(env.DISCORD_CLIENT_ID) && trim(env.DISCORD_CLIENT_SECRET)),
    dbReady: Boolean(trim(env.DATABASE_URL)),
    webhookReady: Boolean(trim(env.PADDLE_WEBHOOK_SECRET)),
    bootErrors: production ? errors : [],
  };

  return config;
}

export const config = loadConfig();