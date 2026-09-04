import { config } from './config.js';
import { migrate } from './db.js';

if (!config.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

try {
  await migrate(config.DATABASE_URL);
  console.log('store_orders migration applied');
} catch (err) {
  console.error(err);
  process.exit(1);
}
