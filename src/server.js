import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

const onVercel = Boolean(process.env.VERCEL);

if (config.bootErrors.length) {
  console.error('Missing required production config:', config.bootErrors.join(', '));
  if (!onVercel) process.exit(1);
}

let db = null;
try {
  db = createDb(config.DATABASE_URL);
} catch (err) {
  console.error('[store] database pool failed', err.message);
}

const app = createApp({ config, db });

let server = null;
if (!onVercel) {
  server = app.listen(config.port, () => {
    console.log(`MARKET GAME — STORE  ${config.STORE_ORIGIN}  (port ${config.port})`);
  });
}

function shutdown() {
  if (!server) {
    db?.close?.().catch(() => {}).finally(() => process.exit(0));
    return;
  }
  server.close(() => {
    db?.close?.().catch(() => {}).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

if (!onVercel) {
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
