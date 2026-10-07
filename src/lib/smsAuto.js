// Helpers for the automatic SMS reader (pure — unit-tested in tests/smsAuto.test.js)

const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };

/**
 * Keep only transactions that are not already in the app.
 * Skips: same SMS id, ignored SMS, or an existing entry with the same amount + type + day
 * (+ same account when both have one) — e.g. the same SMS pasted earlier by hand.
 */
export function pickNew(parsed, expenses = [], knownIds = new Set()) {
  const sig = new Map();
  for (const e of expenses) {
    if (!e || !e.amount) continue;
    const k = Math.round(e.amount * 100) + '|' + (e.type || 'debit') + '|' + dayKey(e.date);
    if (!sig.has(k)) sig.set(k, []);
    sig.get(k).push(e.account || null);
  }
  const out = [];
  for (const p of parsed) {
    if (knownIds.has(p.smsId)) continue;
    const k = Math.round(p.amount * 100) + '|' + p.type + '|' + dayKey(p.date);
    const accs = sig.get(k);
    if (accs && accs.some((a) => !a || !p.account || a === p.account)) continue;
    if (!sig.has(k)) sig.set(k, []);
    sig.get(k).push(p.account || null);
    out.push(p);
  }
  return out;
}

/** Where to start reading the inbox. First time: `firstDays` back. Later: last scan minus 10 min overlap. */
export function scanSince(lastScan, firstDays = 30, now = Date.now()) {
  return lastScan ? lastScan - 10 * 60 * 1000 : now - firstDays * 864e5;
}
