(() => {
  const VAULT_ID = 'disgrowth.vault.v1';
  const DEVICE_ID = 'disgrowth.device.v1';
  const WINDOWS = new Set(['1M', '6M', 'YTD', '5Y', 'ALL']);
  const ALIASES = {
    '6h': '1M',
    '24h': '1M',
    '7d': '6M',
    '1m': '1M',
    '6m': '6M',
    ytd: 'YTD',
    '5y': '5Y',
    all: 'ALL',
  };

  function sanitizeTicker(value) {
    const ticker = String(value || '')
      .trim()
      .toUpperCase();
    return /^[A-Z0-9]{1,8}$/.test(ticker) ? ticker : '';
  }

  function sanitizeWindow(value) {
    const key = String(value || '').trim();
    if (!key) return '';
    if (WINDOWS.has(key)) return key;
    if (ALIASES[key]) return ALIASES[key];
    const upper = key.toUpperCase();
    if (WINDOWS.has(upper)) return upper;
    const alias = ALIASES[key.toLowerCase()];
    return alias || '';
  }

  function bytesToB64(bytes) {
    let bin = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
    return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  }

  function b64ToBytes(value) {
    const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
    const b64 = String(value).replaceAll('-', '+').replaceAll('_', '/') + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deviceKey() {
    if (!window.crypto?.subtle) return null;
    try {
      let packed = localStorage.getItem(DEVICE_ID);
      if (!packed) {
        const raw = window.crypto.getRandomValues(new Uint8Array(32));
        packed = bytesToB64(raw);
        localStorage.setItem(DEVICE_ID, packed);
      }
      return window.crypto.subtle.importKey('raw', b64ToBytes(packed), 'AES-GCM', false, [
        'encrypt',
        'decrypt',
      ]);
    } catch {
      return null;
    }
  }

  async function readVault() {
    const empty = { ticker: '', window: '', login: null };
    if (!window.crypto?.subtle) return empty;
    try {
      const packed = localStorage.getItem(VAULT_ID);
      if (!packed) return empty;
      const buf = b64ToBytes(packed);
      if (buf.length < 29) return empty;
      const key = await deviceKey();
      if (!key) return empty;
      const iv = buf.subarray(0, 12);
      const data = buf.subarray(12);
      const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      const parsed = JSON.parse(new TextDecoder().decode(plain));
      if (!parsed || typeof parsed !== 'object') return empty;
      const login =
        parsed.login && typeof parsed.login === 'object'
          ? {
              username: String(parsed.login.username || '').slice(0, 64),
              globalName: String(parsed.login.globalName || '').slice(0, 64),
              avatar: parsed.login.avatar ? String(parsed.login.avatar).slice(0, 64) : null,
            }
          : null;
      return {
        ticker: sanitizeTicker(parsed.ticker),
        window: sanitizeWindow(parsed.window),
        login,
      };
    } catch {
      return { ticker: '', window: '', login: null };
    }
  }

  async function writeVault(next) {
    if (!window.crypto?.subtle) return;
    try {
      const current = await readVault();
      const payload = {
        ticker: sanitizeTicker(next.ticker != null ? next.ticker : current.ticker),
        window: sanitizeWindow(next.window != null ? next.window : current.window),
        login: next.login === undefined ? current.login : next.login,
      };
      if (payload.login) {
        payload.login = {
          username: String(payload.login.username || '').slice(0, 64),
          globalName: String(payload.login.globalName || '').slice(0, 64),
          avatar: payload.login.avatar ? String(payload.login.avatar).slice(0, 64) : null,
        };
      }
      const key = await deviceKey();
      if (!key) return;
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(payload));
      const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      const out = new Uint8Array(iv.byteLength + cipher.byteLength);
      out.set(iv, 0);
      out.set(new Uint8Array(cipher), iv.byteLength);
      localStorage.setItem(VAULT_ID, bytesToB64(out));
    } catch {
      /* ignore quota / private mode */
    }
  }

  async function syncLoginBoot() {
    const el = document.getElementById('login-boot');
    if (!el) return;
    let boot = {};
    try {
      boot = JSON.parse(el.textContent || '{}');
    } catch {
      boot = {};
    }
    if (boot.loggedIn) {
      await writeVault({
        login: {
          username: String(boot.username || '').slice(0, 64),
          globalName: String(boot.globalName || '').slice(0, 64),
          avatar: boot.avatar ? String(boot.avatar).slice(0, 64) : null,
        },
      });
      return;
    }
    await writeVault({ login: null });
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href="/logout"]');
    if (!link) return;
    writeVault({ login: null }).catch(() => {});
  });

  syncLoginBoot().catch(() => {});

  window.DisgrowthVault = {
    read: readVault,
    write: writeVault,
    sanitizeTicker,
    sanitizeWindow,
  };
})();
