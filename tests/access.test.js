import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasCompletedPurchaseForProduct, purchaseGrantsAccess } from '../src/access.js';

test('completed purchase for the product grants access', () => {
  const row = { transaction_id: 'txn_1', product_id: 'pro_50', status: 'completed' };
  assert.equal(purchaseGrantsAccess(row, { productId: 'pro_50' }), true);
  assert.equal(hasCompletedPurchaseForProduct([row], 'pro_50'), true);
});

test('other statuses or products do not grant access', () => {
  assert.equal(purchaseGrantsAccess({ product_id: 'pro_50', status: 'draft' }, { productId: 'pro_50' }), false);
  assert.equal(purchaseGrantsAccess({ product_id: 'pro_10', status: 'completed' }, { productId: 'pro_50' }), false);
  assert.equal(hasCompletedPurchaseForProduct([], 'pro_50'), false);
});
