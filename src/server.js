import app, { db, onVercel } from './app.js';
import { config } from './config.js';

// Local `npm start` and Vercel Node server detection both use listen().
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
