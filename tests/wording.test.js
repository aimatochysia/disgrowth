import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// Player-facing copy: CR is paper money (never "coin"), the four places are districts (never "area" or "neighbourhood"),
// and "city" only means the whole game world. A hit outside the allowlist is read in context, then fixed or allowed here with a reason.
const FILES = [
  ...readdirSync(new URL('../src/views/', import.meta.url)).map((name) => `views/${name}`),
  'catalog.js', 'legal.js', 'shopNotice.js', 'ticker.js',
];
const ALLOWED = [
  /\bthe city\b/gi, // the game world: "what the city burns", "moving to the city"
  /\bcity market\b/gi, // the market's name
  /\bcity's\b/gi, // "the city's"
];
const BANNED = /\b(coins?|areas?|neighbou?rhoods?|city)\b/gi;

test('player-facing text keeps the CR and district wording', () => {
  for (const file of FILES) {
    let text = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const phrase of ALLOWED) text = text.replace(phrase, '');
    assert.deepEqual(text.match(BANNED), null, file);
  }
});
