import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createDb(databaseUrl) {
  if (!databaseUrl) return null;

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
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
  const sqlPath = path.join(__dirname, '..', 'sql', '001_store_orders.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await db.query(sql);
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
