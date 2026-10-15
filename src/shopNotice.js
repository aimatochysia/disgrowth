import fs from 'node:fs';

export const SHOP_LOG_CHANNEL_ID = '1539296097812357151';

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

export function readBotToken(env = process.env, readFile = fs.readFileSync) {
  if (env && Object.prototype.hasOwnProperty.call(env, 'DISCORD_TOKEN')) {
    const direct = String(env.DISCORD_TOKEN || '').trim();
    if (direct) return direct;
  } else if (env === process.env) {
    const direct = String(process.env.DISCORD_TOKEN || '').trim();
    if (direct) return direct;
  }
  const path = env?.DISGROWTH_BOT_ENV || process.env.DISGROWTH_BOT_ENV || '/opt/disgrowth/bot/.env';
  try {
    const text = readFile(path, 'utf8');
    for (const line of String(text).split('\n')) {
      if (!line || line.trim().startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      if (line.slice(0, eq).trim() !== 'DISCORD_TOKEN') continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value.trim();
    }
  } catch {
    return '';
  }
  return '';
}

export async function postShopNotice({
  token,
  channelId = SHOP_LOG_CHANNEL_ID,
  content,
  fetchImpl = fetch,
}) {
  if (!token || !content) return { posted: false, reason: 'unconfigured' };
  const res = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
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
  const token = readBotToken(env);
  if (!token) {
    log.warn?.('[store] shop notice skipped, no bot token');
    return { posted: false, reason: 'no_token' };
  }
  const content = formatWebsiteShopNotice(interpretation, result);
  try {
    return await postShopNotice({
      token,
      channelId: env?.DISCORD_SHOP_LOG_CHANNEL_ID || SHOP_LOG_CHANNEL_ID,
      content,
      fetchImpl,
    });
  } catch (error) {
    log.warn?.('[store] shop notice failed', error?.message || error);
    return { posted: false, reason: 'failed' };
  }
}
