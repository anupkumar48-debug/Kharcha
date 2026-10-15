// Android back button: close what's open first, then go to Home, then ask "Exit Kharcha?".
import { App as CapApp } from '@capacitor/app';
import { isNative } from './native.js';
import { ask } from './ask.js';

let exitOpen = false;

export async function exitApp() {
  try { await CapApp.exitApp(); } catch {}
}

/** One back press. Returns what it did (used by tests / logs). */
export async function handleBack({ tab, goHome }) {
  // 1) a Yes/Cancel dialog is open → Cancel it
  const dlg = document.querySelector('[role="alertdialog"] [data-v="0"]');
  if (dlg) { dlg.click(); return 'closed-dialog'; }
  // 2) a sheet / popup is open → close it (sheets close on Escape)
  if (document.querySelector('.overlay')) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return 'closed-sheet';
  }
  // 3) on another tab → go Home
  if (tab !== 'home') { goHome(); return 'home'; }
  // 4) on Home → confirm exit
  if (exitOpen) return 'noop';
  exitOpen = true;
  try {
    if (await ask('Exit Kharcha?', 'Exit')) { await exitApp(); return 'exit'; }
    return 'stay';
  } finally { exitOpen = false; }
}

/** Registers the Android back-button listener. Returns a cleanup function. */
export function listenBack(getState) {
  if (!isNative()) return () => {};
  const h = CapApp.addListener('backButton', () => { handleBack(getState()); });
  return () => { Promise.resolve(h).then((x) => x?.remove?.()); };
}
