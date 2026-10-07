// Due-date reminders for EMIs and Udhar (payable + receivable).
// Android app: real scheduled notifications (fire even when the app is closed).
// Laptop / browser: notification when the app is opened or running + in-app "Upcoming dues" card.
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './native.js';
import { loanStatus } from './loan.js';
import { udharStatus } from './udhar.js';
import { money } from './format.js';

const DAY = 864e5;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Unified list of upcoming / overdue dues, sorted by date. */
export function upcomingDues(loans = [], udhar = []) {
  const out = [];
  for (const l of loans) {
    if (l.closed) continue;
    const s = loanStatus(l);
    if (!s.next) continue;
    out.push({
      key: `emi_${l.id}_${s.paid + 1}`, kind: 'emi', dir: 'payable', icon: '📅',
      title: l.name, who: l.lender || '', amount: s.emi, due: startOfDay(s.next.due),
      sub: `EMI ${s.paid + 1}/${s.total}`, ref: l.id,
    });
  }
  for (const u of udhar) {
    const s = udharStatus(u);
    if (s.settled || s.due == null) continue;
    out.push({
      key: `udhar_${u.id}_${u.dueDate}`, kind: 'udhar', dir: u.direction === 'given' ? 'receivable' : 'payable',
      icon: u.direction === 'given' ? '📥' : '📤', title: u.person, who: u.person, amount: s.outstanding, due: s.due,
      sub: u.direction === 'given' ? 'Udhar to collect' : 'Udhar to repay', ref: u.id,
    });
  }
  return out.sort((a, b) => a.due - b.due);
}

export const daysTo = (due, now = Date.now()) => Math.round((due - startOfDay(now)) / DAY);

function text(d, when) {
  const amt = money(d.amount);
  if (d.kind === 'emi') return { title: `📅 EMI ${when}: ${d.title}`, body: `${amt} · ${d.sub}${d.who ? ' · ' + d.who : ''}` };
  if (d.dir === 'receivable') return { title: `📥 Collect ${amt} from ${d.who}`, body: `Udhar ${when}. Remind them to pay you back.` };
  return { title: `📤 Pay ${amt} to ${d.who}`, body: `Udhar repayment ${when}.` };
}

/** Builds the notification plan: day-before + on due date at the chosen time, and a daily nudge while overdue (up to 3 days). */
export function planNotifications(dues, settings, now = Date.now()) {
  const [hh, mm] = String(settings.reminderTime || '09:00').split(':').map(Number);
  const at = (day) => { const d = new Date(day); d.setHours(hh || 9, mm || 0, 0, 0); return d.getTime(); };
  const plan = [];
  for (const d of dues) {
    if (d.kind === 'emi' && !settings.remindEmi) continue;
    if (d.kind === 'udhar' && !settings.remindUdhar) continue;
    const slots = [];
    if (settings.remindDayBefore) slots.push([d.due - DAY, 'due tomorrow']);
    slots.push([d.due, 'due today']);
    for (let i = 1; i <= 3; i++) slots.push([d.due + i * DAY, `overdue by ${i} day${i > 1 ? 's' : ''}`]);
    for (const [day, when] of slots) {
      const t = at(day);
      if (t > now) plan.push({ id: hashInt(d.key + '|' + when), at: t, key: d.key, ...text(d, when) });
    }
  }
  return plan.sort((a, b) => a.at - b.at).slice(0, 60);
}

function hashInt(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

export async function reminderPermission(request = false) {
  if (isNative()) {
    const r = request ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions();
    return r.display; // granted | denied | prompt
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  if (request && Notification.permission === 'default') return (await Notification.requestPermission()) === 'granted' ? 'granted' : 'denied';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

/** Re-schedules everything. Safe to call on every data change. Returns number of scheduled reminders. */
export async function syncReminders(dues, settings) {
  const enabled = settings.remindersOn !== false;
  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications?.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      if (!enabled || (await reminderPermission()) !== 'granted') return 0;
      const plan = planNotifications(dues, settings);
      if (plan.length) {
        await LocalNotifications.schedule({
          notifications: plan.map((p) => ({ id: p.id, title: p.title, body: p.body, schedule: { at: new Date(p.at), allowWhileIdle: true }, extra: { key: p.key } })),
        });
      }
      return plan.length;
    } catch { return 0; }
  }
  // Web: show one notification per due per day for items due tomorrow / today / overdue
  if (!enabled) return 0;
  const shown = readShown();
  const today = new Date().toDateString();
  const fire = [];
  for (const d of dues) {
    if ((d.kind === 'emi' && !settings.remindEmi) || (d.kind === 'udhar' && !settings.remindUdhar)) continue;
    const n = daysTo(d.due);
    const when = n < 0 ? `overdue by ${-n} day${n < -1 ? 's' : ''}` : n === 0 ? 'due today' : n === 1 && settings.remindDayBefore ? 'due tomorrow' : null;
    if (!when || shown[d.key] === today) continue;
    fire.push({ d, when });
  }
  if (fire.length && (await reminderPermission()) === 'granted') {
    for (const { d, when } of fire.slice(0, 5)) {
      try { const t = text(d, when); new Notification(t.title, { body: t.body, tag: d.key, icon: './icons/icon-192.png' }); shown[d.key] = today; } catch {}
    }
    writeShown(shown);
  }
  return fire.length;
}

const SHOWN_KEY = 'kh_reminders_shown';
const readShown = () => { try { return JSON.parse(localStorage.getItem(SHOWN_KEY)) || {}; } catch { return {}; } };
const writeShown = (v) => { try { localStorage.setItem(SHOWN_KEY, JSON.stringify(v)); } catch {} };
