import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

const onVercel = Boolean(process.env.VERCEL);

if (config.bootErrors.length) {
  console.error('Missing required production config:', config.bootErrors.join(', '));
  // Vercel runs NODE_ENV=production. Placeholder env values like "-" used to
  // crash the function after a successful build. Stay up and fail closed instead.
  if (!onVercel) process.exit(1);
}

const db = createDb(config.DATABASE_URL);
const app = createApp({ config, db });

let server = null;
if (!onVercel) {
  server = app.listen(config.port, () => {
    console.log(`MARKET GAME — STORE  ${config.STORE_ORIGIN}  (port ${config.port})`);
  });
}

function shutdown() {
  if (!server) {
    db?.close?.().finally(() => process.exit(0));
    return;
  }
  server.close(() => {
    db?.close?.().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
