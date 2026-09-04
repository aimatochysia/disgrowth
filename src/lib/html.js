const RAW = Symbol('html.raw');

export function raw(value) {
  return { [RAW]: value == null ? '' : String(value) };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stringify(value) {
  if (value == null || value === false) return '';
  if (typeof value === 'object' && Object.hasOwn(value, RAW)) return value[RAW];
  if (Array.isArray(value)) return value.map(stringify).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i += 1) {
    out += strings[i];
    if (i < values.length) out += stringify(values[i]);
  }
  return raw(out);
}

export function render(value) {
  return stringify(value);
}
