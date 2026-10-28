export function usdLabel(interpretation) {
  const currency = String(interpretation?.currency || 'USD').toUpperCase();
  const raw = Number(interpretation?.amount);
  if (!Number.isFinite(raw)) return '—';
  if (currency === 'USD') return (raw / 100).toFixed(2);
  return `${raw} ${currency}`;
}

export function formatWebsiteShopNotice(interpretation, result = {}) {
  const gold = Number(interpretation?.goldDelta) || 0;
  const sign = gold >= 0 ? '+' : '';
  let outcome = 'recorded';
  if (result?.missingPlayer) outcome = 'not_granted';
  else if (result?.applied) outcome = 'granted';
  return [
    `[shop] website ${new Date().toISOString()}`,
    `discord=${interpretation?.discordId || '—'} playerId=${result?.playerId ?? '—'}`,
    `sku=${interpretation?.skuKey || '—'} usd=$${usdLabel(interpretation)} gold=${sign}${gold} GL`,
    `provider=paddle event=${interpretation?.eventName || '—'} order=${interpretation?.lemonOrderId || interpretation?.providerEventId || '—'}`,
    `result=${outcome}`,
  ].join('\n');
}

export async function postShopNotice({ webhookUrl, content, fetchImpl = fetch }) {
  if (!webhookUrl || !content) return { posted: false, reason: 'unconfigured' };
  const res = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `\`\`\`\n${String(content).slice(0, 1800)}\n\`\`\``,
    }),
  });
  if (!res.ok) return { posted: false, reason: `http_${res.status}` };
  return { posted: true };
}

export async function notifyWebsitePayment({
  interpretation,
  result,
  env = process.env,
  fetchImpl,
  log = console,
} = {}) {
  if (result?.duplicate) return { posted: false, reason: 'duplicate' };
  const effect = interpretation?.effect;
  if (effect !== 'gold_grant' && effect !== 'gold_refund') {
    return { posted: false, reason: 'not_payment' };
  }
  const webhookUrl = String(env?.SHOP_LOG_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    log.warn?.('[store] shop notice skipped, SHOP_LOG_WEBHOOK_URL not set');
    return { posted: false, reason: 'no_webhook' };
  }
  const content = formatWebsiteShopNotice(interpretation, result);
  try {
    return await postShopNotice({ webhookUrl, content, fetchImpl });
  } catch (error) {
    log.warn?.('[store] shop notice failed', error?.message || error);
    return { posted: false, reason: 'failed' };
  }
}
