// Bridge to native Android features (Capacitor). Safe no-ops on web/laptop.
// Note: Kharcha does NOT read SMS. Users paste bank SMS themselves (no SMS permission needed).
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

export const isNative = () => !!Capacitor?.isNativePlatform?.();
export const platform = () => Capacitor?.getPlatform?.() || 'web';

/** Read text the user copied (e.g. a bank SMS). Returns '' if not allowed / empty. */
export async function readClipboard() {
  try {
    if (isNative()) {
      const r = await Clipboard.read();
      if (r?.value) return String(r.value);
    }
  } catch {}
  try {
    if (navigator.clipboard?.readText) return (await navigator.clipboard.readText()) || '';
  } catch {}
  return '';
}
