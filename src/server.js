import app, { db, onVercel } from './app.js';
import { config } from './config.js';
import { logEvent } from './lib/log.js';

const port = Number(process.env.PORT) || config.port;
const server = app.listen(port, () => {
  console.log(`MARKET GAME — STORE  ${config.STORE_ORIGIN}  (port ${port})`);
});

server.requestTimeout = 30_000;
server.headersTimeout = 25_000;
server.timeout = 30_000;
server.keepAliveTimeout = 5_000;

let stopping = false;

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logEvent('warn', 'store_shutdown', { signal });
  server.close(() => {
    db?.close?.().catch(() => {}).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('unhandledRejection', (err) => {
  logEvent('error', 'unhandled_rejection', { err: String(err?.message || err) });
});

if (!onVercel) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logEvent('error', 'uncaught_exception', { err: String(err?.message || err) });
    shutdown('uncaughtException');
  });
}

export default app;
