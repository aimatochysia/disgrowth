import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discordId as parseDiscordId } from './lib/validate.js';
import { sanitizeTicker } from './ticker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function poolOptions(databaseUrl, env = process.env) {
  const opts = {
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 4_000,
    query_timeout: 8_000,
    statement_timeout: 8_000,
  };
  const sslFlag = String(env.DATABASE_SSL || env.PGSSLMODE || '').toLowerCase();
  const urlWantsSsl = /sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl);
  if (urlWantsSsl || sslFlag === '1' || sslFlag === 'true' || sslFlag === 'require') {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

export function createDb(databaseUrl) {
  if (!databaseUrl) return null;

  const pool = new pg.Pool(poolOptions(databaseUrl));
  pool.on('error', (err) => {
    console.error('[store] postgres pool error', err.message);
  });

  return {
    pool,

    async query(text, params) {
      return pool.query(text, params);
    },

    async withTransaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback failure
        }
        throw err;
      } finally {
        client.release();
      }
    },

    async findPlayerByDiscordId(discordId) {
      const id = parseDiscordId(discordId);
      if (!id) return null;
      const { rows } = await pool.query(
        `SELECT id, discord_id, credits, bonds, gold_bars,
                subscription_active, subscription_expires_at, onboarding_step
         FROM players
         WHERE discord_id = $1`,
        [id],
      );
      return rows[0] || null;
    },

    async hasUsedFirstPurchase(discordId) {
      const id = parseDiscordId(discordId);
      if (!id) return false;
      const { rows } = await pool.query(
        `SELECT 1 FROM store_first_purchase WHERE discord_id = $1 LIMIT 1`,
        [id],
      );
      return Boolean(rows[0]);
    },

    async findCustomerByDiscordId(discordId) {
      const id = parseDiscordId(discordId);
      if (!id) return null;
      const { rows } = await pool.query(
        `SELECT customer_id, email, discord_id
         FROM customers
         WHERE discord_id = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [id],
      );
      return rows[0] || null;
    },

    async latestTickerQuotes() {
      const { rows } = await pool.query(
        `SELECT a.ticker, a.current_price AS price, prev.price AS prev_price
         FROM assets a
         LEFT JOIN LATERAL (
           SELECT ph.price
           FROM price_history ph
           WHERE ph.asset_id = a.id
             AND ph.grain = 'tick'
           ORDER BY ph.recorded_at DESC
           OFFSET 1
           LIMIT 1
         ) prev ON true
         ORDER BY a.ticker
         LIMIT 16`,
      );
      return rows;
    },

    async listMarketQuotes(at) {
      const { rows } = await pool.query(MARKET_SNAPSHOT_SQL, [at || new Date()]);
      return rows;
    },

    async findMarketAsset(ticker) {
      const symbol = sanitizeTicker(ticker);
      if (!symbol) return null;
      const { rows } = await pool.query(MARKET_ASSET_SQL, [symbol]);
      return rows[0] || null;
    },

    async listMarketHistory({ assetId, grain, since, limit = 2000 } = {}) {
      const id = Number(assetId);
      if (!Number.isInteger(id) || id <= 0) return [];
      const grainKey = grain === 'day' || grain === 'month' ? grain : 'tick';
      const cap = Math.min(Math.max(Number(limit) || 2000, 1), 2000);
      const { rows } = await pool.query(MARKET_OHLC_SQL, [id, grainKey, since, cap]);
      return rows;
    },

    async health() {
      try {
        await pool.query('SELECT 1');
        return 'up';
      } catch {
        return 'down';
      }
    },

    async close() {
      await pool.end();
    },
  };
}

export async function migrate(databaseUrl) {
  const db = createDb(databaseUrl);
  if (!db) throw new Error('DATABASE_URL is not set');
  const sqlDir = path.join(__dirname, '..', 'sql');
  const files = fs
    .readdirSync(sqlDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const name of files) {
    const sql = fs.readFileSync(path.join(sqlDir, name), 'utf8');
    await db.query(sql);
  }
  await db.close();
}

export const PLAYER_COLUMNS = [
  'id',
  'discord_id',
  'credits',
  'bonds',
  'gold_bars',
  'subscription_active',
  'subscription_expires_at',
  'onboarding_step',
];

export const MARKET_SNAPSHOT_SQL = `
SELECT a.ticker, a.name, a.type, a.sector,
       a.current_price AS price,
       open_px.px AS open_price
FROM assets a
LEFT JOIN LATERAL (
  SELECT COALESCE(ph.close, ph.price) AS px
  FROM price_history ph
  WHERE ph.asset_id = a.id
    AND ph.recorded_at <= $1
  ORDER BY ph.recorded_at DESC
  LIMIT 1
) open_px ON true
WHERE a.type IN ('commodity', 'company')
ORDER BY a.type ASC, a.ticker ASC
LIMIT 64
`.trim();

export const MARKET_ASSET_SQL = `
SELECT id, ticker, name, type, sector, current_price
FROM assets
WHERE ticker = $1
LIMIT 1
`.trim();

export const MARKET_OHLC_SQL = `
SELECT recorded_at, period_start, open, high, low, close, price, volume
FROM price_history
WHERE asset_id = $1
  AND grain = $2
  AND recorded_at >= $3
ORDER BY recorded_at ASC
LIMIT $4
`.trim();
