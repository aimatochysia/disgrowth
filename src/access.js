/**
 * Whether a mirrored purchase row grants access to a catalog product.
 * Status must be a completed transaction for that product.
 */
export function purchaseGrantsAccess(purchase, { productId } = {}) {
  if (!purchase) return false;
  if (String(purchase.status || '').toLowerCase() !== 'completed') return false;
  if (productId && String(purchase.product_id) !== String(productId)) return false;
  return true;
}

export function hasCompletedPurchaseForProduct(purchases, productId) {
  if (!productId) return false;
  return (purchases || []).some((row) => purchaseGrantsAccess(row, { productId }));
}
