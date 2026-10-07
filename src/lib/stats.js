import { monthKey, startOfMonth } from './format.js';

export const isSpend = (e) => e.type !== 'credit' && e.category !== 'transfer' && e.category !== 'udhar';

export function monthStats(expenses, ref = Date.now()) {
  const s = startOfMonth(ref);
  const d = new Date(s);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const inMonth = expenses.filter((x) => x.date >= s && x.date < e);
  const spent = inMonth.filter(isSpend).reduce((a, x) => a + x.amount, 0);
  const income = inMonth.filter((x) => x.type === 'credit').reduce((a, x) => a + x.amount, 0);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const now = new Date();
  const dayNo = ref >= s && ref < e ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
  return { start: s, end: e, list: inMonth, spent, income, daysInMonth, dayNo, perDay: spent / Math.max(1, dayNo), projected: (spent / Math.max(1, dayNo)) * daysInMonth };
}

export function byCategory(list, catMap) {
  const m = {};
  for (const x of list.filter(isSpend)) m[x.category] = (m[x.category] || 0) + x.amount;
  return Object.entries(m)
    .map(([id, value]) => ({ ...(catMap[id] || catMap.other), id, value }))
    .sort((a, b) => b.value - a.value);
}

export function byMonth(expenses, n = 6, ref = Date.now()) {
  const out = [];
  const d = new Date(ref);
  for (let i = n - 1; i >= 0; i--) {
    const k = monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1));
    out.push({ key: k, spent: 0, income: 0 });
  }
  const idx = Object.fromEntries(out.map((o, i) => [o.key, i]));
  for (const x of expenses) {
    const i = idx[monthKey(x.date)];
    if (i == null) continue;
    if (x.type === 'credit') out[i].income += x.amount;
    else if (isSpend(x)) out[i].spent += x.amount;
  }
  return out;
}

export function cumulativeByDay(list, start, days, uptoDay = days) {
  const daily = new Array(days).fill(0);
  for (const x of list.filter(isSpend)) {
    const di = new Date(x.date).getDate() - 1;
    if (di >= 0 && di < days) daily[di] += x.amount;
  }
  let run = 0;
  return daily.map((v, i) => (i < uptoDay ? (run += v) : null));
}

export function topMerchants(list, n = 5) {
  const m = {};
  for (const x of list.filter(isSpend)) {
    const k = x.merchant || 'Unspecified';
    m[k] = m[k] || { name: k, value: 0, count: 0 };
    m[k].value += x.amount; m[k].count++;
  }
  return Object.values(m).sort((a, b) => b.value - a.value).slice(0, n);
}
