import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FALLBACK_TICKER,
  createQuoteCache,
  formatQuote,
  quotesFromRows,
  sanitizeTicker,
} from '../src/ticker.js';

test('ticker symbols are short A–Z / 0–9 only', () => {
  assert.equal(sanitizeTicker('prdc'), 'PRDC');
  assert.equal(sanitizeTicker('<script>'), '');
  assert.equal(sanitizeTicker('PRDC;DROP'), '');
  assert.equal(sanitizeTicker('TOOLONGNAME'), '');
});

test('formatQuote shows percent change from the previous tick', () => {
  const up = formatQuote({ ticker: 'MPRT', price: 114.7089, prev_price: 111.8754 });
  assert.equal(up.ticker, 'MPRT');
  assert.equal(up.price, '114.71');
  assert.equal(up.dir, 'up');
  assert.match(up.change, /^\+2\.\d{2}%$/);

  const down = formatQuote({ ticker: 'PRDC', price: 39.2633, prev_price: 39.5986 });
  assert.equal(down.dir, 'down');
  assert.match(down.change, /^−0\.\d{2}%$/);

  const flat = formatQuote({ ticker: 'FUEL', price: 10, prev_price: 10 });
  assert.equal(flat.dir, 'flat');
  assert.equal(flat.change, '+0.00%');
});

test('bad rows fall back to the static strip', () => {
  assert.equal(quotesFromRows(null), FALLBACK_TICKER);
  assert.equal(quotesFromRows([{ ticker: '../../etc', price: 1 }]), FALLBACK_TICKER);
  assert.equal(quotesFromRows([{ ticker: 'PRDC', price: 12.5 }])[0].ticker, 'PRDC');
});

test('quote cache serves memory and does not stampede load', async () => {
  let loads = 0;
  const cache = createQuoteCache({
    ttlMs: 60_000,
    load: async () => {
      loads += 1;
      return [{ ticker: 'CHEM', price: 61.94, prev_price: 61.77 }];
    },
  });
  const a = cache.refresh();
  const b = cache.refresh();
  await Promise.all([a, b]);
  assert.equal(loads, 1);
  assert.equal(cache.snapshot()[0].ticker, 'CHEM');
  assert.equal(loads, 1);
  cache.stop();
});
