import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// Player-facing copy: CR is paper money (never "coin"), the four places are cities (never "district", "area" or "neighbourhood"),
// and singular "city" only means the whole game world. A hit outside the allowlist is read in context, then fixed or allowed here with a reason.
const FILES = [
  ...readdirSync(new URL('../src/views/', import.meta.url)).map((name) => `views/${name}`),
  'catalog.js', 'legal.js', 'shopNotice.js', 'ticker.js',
];
const ALLOWED = [
  /\bthe city\b/gi, // the game world: "what the city burns", "moving to the city"
  /\bcity market\b/gi, // the market's name
  /\bcity's\b/gi, // "the city's"
  /<code>\/city<\/code>/gi, // the game's main slash command
];
const BANNED = /\b(coins?|districts?|areas?|neighbou?rhoods?|city)\b/gi;

test('player-facing text keeps the CR and cities wording', () => {
  for (const file of FILES) {
    let text = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const phrase of ALLOWED) text = text.replace(phrase, '');
    assert.deepEqual(text.match(BANNED), null, file);
  }
});
