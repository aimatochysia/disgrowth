export function logEvent(level, msg, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}
