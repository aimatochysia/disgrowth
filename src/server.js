import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

if (config.bootErrors.length) {
  console.error('Missing required production config:', config.bootErrors.join(', '));
  process.exit(1);
}

const db = createDb(config.DATABASE_URL);
const app = createApp({ config, db });

const server = app.listen(config.port, () => {
  console.log(`MARKET GAME — STORE  ${config.STORE_ORIGIN}  (port ${config.port})`);
});

function shutdown() {
  server.close(() => {
    db?.close?.().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
