// Vercel Express preset looks here first (src/app.js). Default-export the live
// app — not the factory. createApp lives in create-app.js so this file stays
// an Express instance.
import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './create-app.js';

export const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

if (config.bootErrors.length) {
  console.error('Missing required production config:', config.bootErrors.join(', '));
  if (!onVercel) process.exit(1);
}

export let db = null;
try {
  db = createDb(config.DATABASE_URL);
} catch (err) {
  console.error('[store] database pool failed', err.message);
}

const app = createApp({ config, db });

export default app;
