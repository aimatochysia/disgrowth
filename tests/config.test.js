import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig, real } from '../src/config.js';
import { poolOptions } from '../src/db.js';

test('dash and other placeholders are treated as empty', () => {
  assert.equal(real('-'), '');
  assert.equal(real('—'), '');
  assert.equal(real('changeme'), '');
  assert.equal(real('null'), '');
  assert.equal(real('  pri_real  '), 'pri_real');
});

test('production dash env fails boot checks and does not use the dev session secret', () => {
  const cfg = loadConfig({
    NODE_ENV: 'production',
    SESSION_SECRET: '-',
    DISCORD_CLIENT_ID: '-',
    DISCORD_CLIENT_SECRET: '-',
    DATABASE_URL: '-',
    PADDLE_API_KEY: '-',
    PADDLE_WEBHOOK_SECRET: '-',
    PADDLE_PRICE_GOLD_10: '-',
    PADDLE_PRICE_GOLD_25: '-',
    PADDLE_PRICE_GOLD_50: '-',
    PADDLE_PRICE_GOLD_100: '-',
  });
  assert.equal(cfg.SESSION_SECRET, '');
  assert.equal(cfg.DATABASE_URL, '');
  assert.equal(cfg.checkoutReady, false);
  assert.equal(cfg.oauthReady, false);
  assert.ok(cfg.bootErrors.includes('SESSION_SECRET'));
  assert.ok(cfg.bootErrors.includes('DISCORD_CLIENT_ID'));
  assert.ok(cfg.bootErrors.includes('DISCORD_CLIENT_SECRET'));
  assert.ok(cfg.bootErrors.includes('DATABASE_URL'));
});

test('production session secret shorter than 32 characters is a boot error', () => {
  const cfg = loadConfig({
    NODE_ENV: 'production',
    SESSION_SECRET: 'too-short-session-secret',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DATABASE_URL: 'postgres://example',
  });
  assert.ok(cfg.bootErrors.some((item) => /SESSION_SECRET/.test(item)));
});

test('production localhost DATABASE_URL is ignored so Vercel can still render', () => {
  const cfg = loadConfig({
    NODE_ENV: 'production',
    VERCEL: '1',
    SESSION_SECRET: 'test-session-secret-32-characters-min',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DATABASE_URL: 'postgresql://market_game:market_game@127.0.0.1:5432/market_game',
  });
  assert.equal(cfg.DATABASE_URL, '');
  assert.equal(cfg.dbReady, false);
  assert.ok(cfg.bootErrors.some((item) => /localhost/.test(item)));
});

test('PADDLE_ENV is not silently defaulted from NODE_ENV', () => {
  const cfg = loadConfig({
    NODE_ENV: 'development',
    SESSION_SECRET: 'test-session-secret-32-characters-min',
  });
  assert.equal(cfg.PADDLE_ENV, '');
  assert.equal(cfg.PADDLE_API_BASE, '');
  assert.equal(cfg.checkoutReady, false);
});

test('live client token with sandbox env is a boot error', () => {
  const cfg = loadConfig({
    NODE_ENV: 'production',
    SESSION_SECRET: 'test-session-secret-32-characters-min',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DATABASE_URL: 'postgres://db.example/game',
    PADDLE_ENV: 'sandbox',
    PADDLE_CLIENT_TOKEN: 'live_should_not_run_sandbox',
  });
  assert.ok(cfg.bootErrors.some((item) => /PADDLE_CLIENT_TOKEN/.test(item)));
});

test('blank paddle keys are treated as empty', () => {
  const cfg = loadConfig({
    NODE_ENV: 'production',
    SESSION_SECRET: 'test-session-secret-32-characters-min',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DATABASE_URL: 'postgres://db.example/game',
    PADDLE_ENV: 'production',
    PADDLE_API_KEY: 'blank',
    PADDLE_WEBHOOK_SECRET: 'blank',
    PADDLE_PRICE_GOLD_10: 'pri_gold_10',
    PADDLE_PRICE_GOLD_25: 'pri_gold_25',
    PADDLE_PRICE_GOLD_50: 'pri_gold_50',
    PADDLE_PRICE_GOLD_100: 'pri_gold_100',
  });
  assert.equal(cfg.checkoutReady, false);
});

test('pool enables SSL when the URL asks for it', () => {
  const withSsl = poolOptions('postgres://u:p@host/db?sslmode=require', {});
  assert.deepEqual(withSsl.ssl, { rejectUnauthorized: false });
  const without = poolOptions('postgres://u:p@localhost/db', {});
  assert.equal(withSsl.connectionString.includes('sslmode=require'), true);
  assert.equal(without.ssl, undefined);
});
