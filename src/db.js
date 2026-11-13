import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discordId as parseDiscordId } from './lib/validate.js';
import { sanitizeTicker, tickerSpellings } from './ticker.js';

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

  // assets.active arrives with the bot's retire-MACH migration; until then (42703) every asset counts as active.
  async function queryActive(sql, params) {
    try {
      return await pool.query(sql.replaceAll('{active}', 'a.active'), params);
    } catch (err) {
      if (err?.code !== '42703') throw err;
      return pool.query(sql.replaceAll('{active}', 'true'), params);
    }
  }

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
                subscription_active, subscription_expires_at
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

    async createSession(row) {
      await pool.query(`DELETE FROM store_sessions WHERE expires_at < NOW()`);
      await pool.query(
        `INSERT INTO store_sessions (id_hash, discord_id, username, global_name, avatar, email, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.idHash, row.discordId, row.username, row.globalName, row.avatar, row.email, row.expiresAt],
      );
    },

    async findSession(idHash) {
      const { rows } = await pool.query(
        `SELECT discord_id, username, global_name, avatar, email, expires_at
         FROM store_sessions WHERE id_hash = $1 AND expires_at > NOW()`,
        [idHash],
      );
      return rows[0] || null;
    },

    async deleteSession(idHash) {
      await pool.query(`DELETE FROM store_sessions WHERE id_hash = $1`, [idHash]);
    },

    async deleteSessionsFor(discordId) {
      await pool.query(`DELETE FROM store_sessions WHERE discord_id = $1`, [discordId]);
    },

    async createPendingOrder({ transactionId, discordId, skuKey }) {
      await pool.query(
        `INSERT INTO pending_orders (transaction_id, discord_id, sku_key) VALUES ($1, $2, $3)`,
        [transactionId, discordId, skuKey],
      );
    },

    async findPendingOrder(transactionId) {
      const { rows } = await pool.query(
        `SELECT discord_id, sku_key FROM pending_orders WHERE transaction_id = $1`,
        [transactionId],
      );
      return rows[0] || null;
    },

    async latestTickerQuotes() {
      const { rows } = await queryActive(
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
         WHERE {active} AND a.type <> 'company'
         ORDER BY a.ticker
         LIMIT 16`,
      );
      return rows;
    },

    async listMarketQuotes() {
      return (await queryActive(MARKET_SNAPSHOT_SQL)).rows;
    },

    /** The bot's calendar, written at its boot; null until then. */
    async getGameTime() {
      const { rows } = await pool.query("SELECT value FROM engine_state WHERE key = 'game_time'");
      try {
        return rows[0] ? JSON.parse(rows[0].value) : null;
      } catch {
        return null;
      }
    },

    async findMarketAsset(ticker) {
      const symbol = sanitizeTicker(ticker);
      if (!symbol) return null;
      const { rows } = await queryActive(MARKET_ASSET_SQL, [tickerSpellings(symbol)]);
      return rows[0] || null;
    },

    async listMarketHistory({ assetId, grain, since, limit = 120 } = {}) {
      const id = Number(assetId);
      if (!Number.isInteger(id) || id <= 0) return [];
      const grainKey = grain === 'month' ? 'month' : 'day';
      const cap = Math.min(Math.max(Number(limit) || 120, 1), 400);
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
];

export const MARKET_SNAPSHOT_SQL = `
SELECT ticker, name, price, volume, change_7d, change_1m, change_6m, change_1y
FROM asset_quotes q
WHERE q.type <> 'company'
  AND EXISTS (SELECT 1 FROM assets a WHERE a.ticker = q.ticker AND {active})
ORDER BY ticker ASC
LIMIT 50
`.trim();

export const MARKET_ASSET_SQL = `
SELECT a.id, a.ticker, a.name, a.current_price
FROM assets a
WHERE a.ticker = ANY($1)
  AND {active}
  AND a.type <> 'company'
LIMIT 1
`.trim();

export const MARKET_OHLC_SQL = `
SELECT period_start, recorded_at, close, price
FROM price_history
WHERE asset_id = $1
  AND grain = $2
  AND period_start >= $3
ORDER BY period_start ASC
LIMIT $4
`.trim();
