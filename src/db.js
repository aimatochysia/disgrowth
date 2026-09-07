import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function poolOptions(databaseUrl, env = process.env) {
  const opts = {
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 4_000,
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
      const { rows } = await pool.query(
        `SELECT id, discord_id, credits, bonds, gold_bars, marks,
                subscription_active, subscription_expires_at, onboarding_step
         FROM players
         WHERE discord_id = $1`,
        [String(discordId)],
      );
      return rows[0] || null;
    },

    async hasUsedFirstPurchase(discordId) {
      const { rows } = await pool.query(
        `SELECT 1 FROM store_first_purchase WHERE discord_id = $1 LIMIT 1`,
        [String(discordId)],
      );
      return Boolean(rows[0]);
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
  'marks',
  'subscription_active',
  'subscription_expires_at',
  'onboarding_step',
];
