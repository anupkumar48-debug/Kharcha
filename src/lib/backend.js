// On-device data layer. Everything is saved in this phone / browser only:
// no server, no login, no cloud. Family members each keep their own data on their own device.
//
// Profile + optional 4-digit PIN lock live under kh_profile.
// Collections (expenses, loans, udhar) and settings live under kh_local_<name>.

const PROFILE_KEY = 'kh_profile';
const UNLOCK_KEY = 'kh_unlocked'; // sessionStorage: stays unlocked until the app is closed
const listeners = new Set();

const safeGet = (store, k) => { try { return store.getItem(k); } catch { return null; } };
const safeSet = (store, k, v) => { try { store.setItem(k, v); return true; } catch { return false; } };
const safeDel = (store, k) => { try { store.removeItem(k); } catch {} };

export function readProfile() {
  try { return JSON.parse(safeGet(localStorage, PROFILE_KEY)) || null; } catch { return null; }
}
function writeProfile(p) {
  if (p) safeSet(localStorage, PROFILE_KEY, JSON.stringify(p));
  else safeDel(localStorage, PROFILE_KEY);
}

/** Current state: null (first run) | {locked:true, profile} | {uid, name, ...profile} */
function currentUser() {
  const p = readProfile();
  if (!p) return null;
  if (p.pinHash && safeGet(sessionStorage, UNLOCK_KEY) !== '1') return { locked: true, profile: p };
  return { uid: 'local', name: p.name || '', hasPin: !!p.pinHash };
}
const emit = () => { const u = currentUser(); listeners.forEach((f) => f(u)); };

export function onUser(cb) {
  listeners.add(cb);
  cb(currentUser());
  return () => listeners.delete(cb);
}

// Ask the browser not to clear our data under storage pressure (web/PWA). Harmless elsewhere.
export function keepDataPersistent() {
  try { navigator.storage?.persist?.(); } catch {}
}

/* ---------------- PIN lock (optional) ---------------- */
async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 7; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + (h >>> 0).toString(16);
  }
}
const hashPin = (pin, salt) => sha256(salt + ':' + pin);

export async function setupProfile(name, pin) {
  const salt = Math.random().toString(36).slice(2, 10);
  const p = { name: (name || '').trim(), createdAt: Date.now(), salt, pinHash: pin ? await hashPin(pin, salt) : null };
  writeProfile(p);
  safeSet(sessionStorage, UNLOCK_KEY, '1');
  emit();
}

export async function unlock(pin) {
  const p = readProfile();
  if (!p?.pinHash) return true;
  if ((await hashPin(String(pin), p.salt)) !== p.pinHash) throw new Error('Wrong PIN');
  safeSet(sessionStorage, UNLOCK_KEY, '1');
  emit();
  return true;
}

export async function setPin(pin) {
  const p = readProfile() || { name: '', createdAt: Date.now() };
  p.salt = p.salt || Math.random().toString(36).slice(2, 10);
  p.pinHash = pin ? await hashPin(String(pin), p.salt) : null;
  writeProfile(p);
  safeSet(sessionStorage, UNLOCK_KEY, '1');
  emit();
}

export function lockNow() {
  safeDel(sessionStorage, UNLOCK_KEY);
  emit();
}

export function setProfileName(name) {
  const p = readProfile();
  if (p) { p.name = name; writeProfile(p); }
}

/** Erases every Kharcha record on this device and returns to the welcome screen. */
export function eraseEverything() {
  try { Object.keys(localStorage).filter((k) => k.startsWith('kh_')).forEach((k) => localStorage.removeItem(k)); } catch {}
  safeDel(sessionStorage, UNLOCK_KEY);
  emit();
}

/* ---------------- Data store (same API the screens already use) ---------------- */
export function createStore() {
  const key = (c) => `kh_local_${c}`;
  const subs = {};
  const mem = {};
  const empty = (c) => (c === 'settings' ? null : []);
  const read = (c) => { try { return JSON.parse(safeGet(localStorage, key(c))) ?? empty(c); } catch { return empty(c); } };
  const sorted = (a) => [...a].sort((x, y) => (y.date || 0) - (x.date || 0));
  const get = (c) => (mem[c] ??= read(c));
  const write = (c, v) => {
    mem[c] = v;
    if (!safeSet(localStorage, key(c), JSON.stringify(v))) {
      window.dispatchEvent(new CustomEvent('kh-storage-full'));
    }
    (subs[c] || []).forEach((f) => f(c === 'settings' ? v : sorted(v)));
  };
  const on = (c, cb) => {
    (subs[c] ||= []).push(cb);
    cb(c === 'settings' ? get(c) : sorted(get(c)));
    return () => (subs[c] = subs[c].filter((f) => f !== cb));
  };
  return {
    sub: on,
    subSettings: (cb) => on('settings', cb),
    async saveSettings(p) { write('settings', { ...(get('settings') || {}), ...p }); },
    async add(c, o) { write(c, [...get(c).filter((x) => x.id !== o.id), o]); },
    async update(c, id, p) { write(c, get(c).map((x) => (x.id === id ? { ...x, ...p } : x))); },
    async remove(c, id) { write(c, get(c).filter((x) => x.id !== id)); },
    async bulkAdd(c, arr) { const ids = new Set(arr.map((a) => a.id)); write(c, [...get(c).filter((x) => !ids.has(x.id)), ...arr]); },
    async replaceAll(c, arr) { write(c, arr); },
  };
}

/** One-time move of data saved by older test builds (demo mode) into the new on-device keys. */
export function migrateOldDemoData() {
  try {
    if (localStorage.getItem('kh_local_expenses')) return;
    const old = Object.keys(localStorage).find((k) => /^kh_demo_[a-z0-9]+_expenses$/.test(k));
    if (!old) return;
    const prefix = old.replace(/_expenses$/, '_');
    for (const c of ['expenses', 'loans', 'udhar', 'settings']) {
      const v = localStorage.getItem(prefix + c);
      if (v) localStorage.setItem('kh_local_' + c, v);
    }
  } catch {}
}
