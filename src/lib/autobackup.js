// Automatic daily backup into a folder on the device.
//
// Android app : Phone storage › Documents › Kharcha   (public folder — survives uninstall / app-data clear)
// Laptop      : a folder you pick once (Chrome / Edge). The browser may ask once per session to continue.
// Files       : kharcha-backup-YYYY-MM-DD.json — today's file is overwritten as you add data,
//               so there is always one up-to-date file per day the app was used.
// Rotation    : keeps the last 7 daily files + the newest file of each of the last 12 months.
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNative } from './native.js';
import { filesToDelete, NAME_RE } from './rotation.js';
export { filesToDelete };

export const FOLDER = 'Kharcha';
const META_KEY = 'kh_autobackup_meta';

const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const fileNameFor = (day = today()) => `kharcha-backup-${day}.json`;

export function readMeta() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } }
function writeMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...m })); } catch {} }

function quickHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; }

/* ------------------------------ Laptop (File System Access API) ------------------------------ */
const webSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('kharcha-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) { const db = await idb(); return new Promise((res) => { const t = db.transaction('h').objectStore('h').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); }
async function idbSet(k, v) { const db = await idb(); return new Promise((res) => { const t = db.transaction('h', 'readwrite').objectStore('h').put(v, k); t.onsuccess = () => res(); t.onerror = () => res(); }); }

/** Status for the settings card. */
export async function autoBackupStatus() {
  if (isNative()) return { supported: true, where: 'Phone storage › Documents › Kharcha', ready: true };
  if (!webSupported()) return { supported: false, where: null, ready: false };
  try {
    const h = await idbGet('dir');
    if (!h) return { supported: true, where: null, ready: false, needsFolder: true };
    const p = await h.queryPermission({ mode: 'readwrite' });
    return { supported: true, where: h.name, ready: p === 'granted', needsPermission: p !== 'granted' };
  } catch { return { supported: true, where: null, ready: false, needsFolder: true }; }
}

/** Laptop: pick the folder once (must be called from a click). */
export async function chooseBackupFolder() {
  const h = await window.showDirectoryPicker({ id: 'kharcha-backup', mode: 'readwrite', startIn: 'documents' });
  await idbSet('dir', h);
  return h.name;
}

/** Laptop: browsers ask again after a restart (must be called from a click). */
export async function resumeBackupFolder() {
  const h = await idbGet('dir');
  if (!h) return false;
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/* ------------------------------ Android ------------------------------ */
async function nativeEnsurePermission() {
  try {
    const p = await Filesystem.checkPermissions();
    if (p.publicStorage !== 'granted') await Filesystem.requestPermissions(); // only shown on Android 9 and older
  } catch {}
}

async function nativeWrite(name, json) {
  await nativeEnsurePermission();
  try { await Filesystem.mkdir({ path: FOLDER, directory: Directory.Documents, recursive: true }); } catch {}
  await Filesystem.writeFile({ path: `${FOLDER}/${name}`, data: json, directory: Directory.Documents, encoding: Encoding.UTF8 });
  try {
    const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Documents });
    const names = files.map((f) => (typeof f === 'string' ? f : f.name));
    for (const n of filesToDelete(names)) {
      try { await Filesystem.deleteFile({ path: `${FOLDER}/${n}`, directory: Directory.Documents }); } catch {}
    }
  } catch {}
}

/** Android: newest backup in the folder (for one-tap restore). */
export async function readLatestNativeBackup() {
  const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Documents });
  const names = files.map((f) => (typeof f === 'string' ? f : f.name)).filter((n) => NAME_RE.test(n)).sort().reverse();
  if (!names.length) throw new Error('No backup found in Documents › Kharcha');
  const r = await Filesystem.readFile({ path: `${FOLDER}/${names[0]}`, directory: Directory.Documents, encoding: Encoding.UTF8 });
  return { name: names[0], data: JSON.parse(r.data) };
}

/* ------------------------------ Run ------------------------------ */
/**
 * Writes today's backup if the data changed since the last auto-backup.
 * Returns { status: 'saved'|'unchanged'|'needs-folder'|'needs-permission'|'unsupported'|'error', file?, at?, error? }
 */
export async function runAutoBackup(payload) {
  const json = JSON.stringify({ app: 'kharcha', version: 2, exportedAt: new Date().toISOString(), auto: true, ...payload }, null, 1);
  const sig = quickHash(JSON.stringify(payload));
  const meta = readMeta();
  const name = fileNameFor();
  if (meta.sig === sig && meta.file === name) return { status: 'unchanged', file: meta.file, at: meta.at };
  try {
    if (isNative()) {
      await nativeWrite(name, json);
    } else {
      if (!webSupported()) return { status: 'unsupported' };
      const dir = await idbGet('dir');
      if (!dir) return { status: 'needs-folder' };
      if ((await dir.queryPermission({ mode: 'readwrite' })) !== 'granted') return { status: 'needs-permission' };
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(json);
      await w.close();
      const names = [];
      for await (const [n] of dir.entries()) names.push(n);
      for (const n of filesToDelete(names)) { try { await dir.removeEntry(n); } catch {} }
    }
    const at = Date.now();
    writeMeta({ sig, file: name, at, error: null });
    return { status: 'saved', file: name, at };
  } catch (e) {
    writeMeta({ error: String(e?.message || e) });
    return { status: 'error', error: String(e?.message || e) };
  }
}
