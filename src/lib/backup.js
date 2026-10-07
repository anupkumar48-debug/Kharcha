// Backup / restore of on-device data.
// Android app: writes the file and opens the share sheet (save to Drive, WhatsApp to yourself, Files…).
// Browser / laptop: downloads kharcha-backup-<date>.json.
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './native.js';

export function backupFileName() {
  return `kharcha-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function exportBackup(payload) {
  const json = JSON.stringify({ app: 'kharcha', version: 2, exportedAt: new Date().toISOString(), ...payload }, null, 1);
  const name = backupFileName();
  if (isNative()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Kharcha backup', text: 'Kharcha backup file — keep it safe', files: [uri], dialogTitle: 'Save your Kharcha backup' });
    return name;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return name;
}

/** Same as exportBackup but for CSV (expenses list). */
export async function exportText(name, text, mime = 'text/csv') {
  if (isNative()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [uri], dialogTitle: 'Share ' + name });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function readBackupFile(file) {
  const data = JSON.parse(await file.text());
  if (!data || (!data.expenses && !data.loans && !data.udhar && !data.settings)) throw new Error('Not a Kharcha backup file');
  return data;
}
