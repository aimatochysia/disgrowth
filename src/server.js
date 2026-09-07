import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

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

// Vercel turns src/server.js into a function by capturing listen(). Skipping
// that call leaves every path as FUNCTION_INVOCATION_FAILED. PORT is internal
// on Vercel; locally it is 3000 unless you set it.
const port = Number(process.env.PORT) || config.port;
const server = app.listen(port, () => {
  console.log(`MARKET GAME — STORE  ${config.STORE_ORIGIN}  (port ${port})`);
});

function shutdown() {
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
