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
    SESSION_SECRET: SESSION_SECRET || 'dev-only-insecure-session-secret-32ch',
    SESSION_DAYS,
    DISCORD_CLIENT_ID: trim(env.DISCORD_CLIENT_ID),
    DISCORD_CLIENT_SECRET: trim(env.DISCORD_CLIENT_SECRET),
    DISCORD_REDIRECT_URI:
      trim(env.DISCORD_REDIRECT_URI) || `${STORE_ORIGIN.replace(/\/$/, '')}/api/auth/discord/callback`,
    DATABASE_URL: trim(env.DATABASE_URL),
    LEMONSQUEEZY_STORE_ID: trim(env.LEMONSQUEEZY_STORE_ID),
    LEMONSQUEEZY_WEBHOOK_SECRET: trim(env.LEMONSQUEEZY_WEBHOOK_SECRET),
    LEMONSQUEEZY_VARIANT_GOLD_STARTER: trim(env.LEMONSQUEEZY_VARIANT_GOLD_STARTER),
    LEMONSQUEEZY_VARIANT_GOLD_PACK: trim(env.LEMONSQUEEZY_VARIANT_GOLD_PACK),
    LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS: trim(env.LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS),
    LEMONSQUEEZY_CHECKOUT_BASE: trim(env.LEMONSQUEEZY_CHECKOUT_BASE).replace(/\/$/, ''),
    OPERATOR_LEGAL_NAME: OPERATOR_LEGAL_NAME || 'the Operator (preview)',
    OPERATOR_TRADING_NAME: trim(env.OPERATOR_TRADING_NAME) || 'Market Game',
    OPERATOR_REGISTERED_ADDRESS: trim(env.OPERATOR_REGISTERED_ADDRESS) || '[address not yet published]',
    OPERATOR_COUNTRY: trim(env.OPERATOR_COUNTRY) || '[country not yet published]',
    GOVERNING_LAW: trim(env.GOVERNING_LAW) || '[governing law not yet published]',
    VENUE: trim(env.VENUE) || '[venue not yet published]',
    OPERATOR_CONTACT_EMAIL: trim(env.OPERATOR_CONTACT_EMAIL) || 'contact@example.invalid',
    SUPPORT_EMAIL: trim(env.SUPPORT_EMAIL) || 'support@example.invalid',
    PRIVACY_EMAIL: trim(env.PRIVACY_EMAIL) || 'privacy@example.invalid',
    DISCORD_SUPPORT_INVITE: trim(env.DISCORD_SUPPORT_INVITE),
    DISCORD_BOT_PUBLIC_URL: trim(env.DISCORD_BOT_PUBLIC_URL),
    LOG_RETENTION_DAYS: Number(env.LOG_RETENTION_DAYS) || 90,
    SLA_DAYS: Number(env.SLA_DAYS) || 5,
    TRANSFER_MECHANISM: trim(env.TRANSFER_MECHANISM) || 'hosting may process data outside your country',
    LEGAL_DATE: trim(env.LEGAL_DATE) || '2026-09-04',
    previewLegal,
    checkoutReady: Boolean(
      trim(env.LEMONSQUEEZY_CHECKOUT_BASE) &&
        trim(env.LEMONSQUEEZY_VARIANT_GOLD_STARTER) &&
        trim(env.LEMONSQUEEZY_VARIANT_GOLD_PACK) &&
        trim(env.LEMONSQUEEZY_VARIANT_ACCOUNTANT_PASS),
    ),
    oauthReady: Boolean(trim(env.DISCORD_CLIENT_ID) && trim(env.DISCORD_CLIENT_SECRET)),
    dbReady: Boolean(trim(env.DATABASE_URL)),
    webhookReady: Boolean(trim(env.LEMONSQUEEZY_WEBHOOK_SECRET) && trim(env.LEMONSQUEEZY_STORE_ID)),
    bootErrors: production ? errors : [],
  };

  return config;
}

export const config = loadConfig();
