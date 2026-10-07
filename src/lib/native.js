// Bridge to native Android features (Capacitor). Safe no-ops on web/laptop.
// SMS: on Android the app can read bank SMS from the inbox (family edition, only after the user allows it).
// On laptop/iPhone users paste SMS instead.
import { Capacitor, registerPlugin } from '@capacitor/core';
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

/* ------------------------------ Auto SMS reader (Android only) ------------------------------ */
// Native side: android/app/src/main/java/com/kharcha/app/SmsReaderPlugin.java (written by scripts/setup-android.mjs)
const SmsReader = registerPlugin('SmsReader');
export const smsSupported = () => isNative() && platform() === 'android';

/** 'granted' | 'denied' | 'prompt' | 'unsupported' */
export async function smsPermission() {
  if (!smsSupported()) return 'unsupported';
  try { return (await SmsReader.checkPermissions())?.sms || 'prompt'; } catch { return 'unsupported'; }
}
export async function requestSmsPermission() {
  if (!smsSupported()) return 'unsupported';
  try { return (await SmsReader.requestPermissions())?.sms || 'denied'; } catch { return 'denied'; }
}
/** Inbox messages newer than `since` (ms). Returns [{sender, body, date}] — never leaves the phone. */
export async function readInboxSms(since = 0, limit = 2000) {
  if (!smsSupported()) return [];
  const r = await SmsReader.read({ since: Math.floor(since), limit });
  const list = Array.isArray(r?.messages) ? r.messages : [];
  // banks send from names like VM-HDFCBK; skip personal phone numbers
  return list.filter((m) => /[a-z]/i.test(String(m?.sender || '')));
}
