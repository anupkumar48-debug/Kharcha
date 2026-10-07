let CUR = 'INR';
export const setCurrency = (c) => (CUR = c || 'INR');

export function money(n, opts = {}) {
  const v = Number(n) || 0;
  const dec = opts.dec ?? (Math.abs(v) >= 1000 || Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2);
  try {
    return new Intl.NumberFormat(CUR === 'INR' ? 'en-IN' : undefined, {
      style: 'currency', currency: CUR, minimumFractionDigits: dec, maximumFractionDigits: dec,
    }).format(v);
  } catch {
    return CUR + ' ' + v.toFixed(0);
  }
}

export function compact(n) {
  const v = Math.abs(Number(n) || 0), s = n < 0 ? '-' : '';
  if (CUR === 'INR') {
    if (v >= 1e7) return s + (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (v >= 1e5) return s + (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
  }
  if (v >= 1e3) return s + (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return s + v.toFixed(0);
}

export const fmtDate = (t, o = { day: 'numeric', month: 'short' }) => new Date(t).toLocaleDateString('en-IN', o);
export const monthKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
export const monthLabel = (k) => { const [y, m] = k.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); };
export const startOfMonth = (t = Date.now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
export const toInputDate = (t) => { const d = new Date(t); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
