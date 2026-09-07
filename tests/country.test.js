import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countryFromRequest } from '../src/country.js';

test('reads x-vercel-ip-country when it is a real ISO code', () => {
  assert.equal(countryFromRequest({ headers: { 'x-vercel-ip-country': 'de' } }), 'DE');
  assert.equal(countryFromRequest({ headers: { 'x-vercel-ip-country': 'US' } }), 'US');
});

test('omits missing, unknown, and internal sentinels so Paddle auto-detects', () => {
  assert.equal(countryFromRequest({ headers: {} }), null);
  assert.equal(countryFromRequest({ headers: { 'x-vercel-ip-country': 'OTHERS' } }), null);
  assert.equal(countryFromRequest({ headers: { 'x-vercel-ip-country': 'XX' } }), null);
  assert.equal(countryFromRequest({ headers: { 'x-vercel-ip-country': 'ZZ' } }), null);
  assert.equal(countryFromRequest({ headers: { 'x-vercel-ip-country': 'T1' } }), null);
  assert.equal(countryFromRequest({ headers: { 'x-vercel-ip-country': 'USA' } }), null);
});
