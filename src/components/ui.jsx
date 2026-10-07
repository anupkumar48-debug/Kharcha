import { createContext, useContext, useEffect } from 'react';
import { money, fmtDate } from '../lib/format.js';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function TxRow({ t, onClick }) {
  const { catMap } = useApp();
  const c = catMap[t.category] || catMap.other;
  const credit = t.type === 'credit';
  return (
    <div className={'tx' + (onClick ? ' click' : '')} onClick={onClick}>
      <div className="av" style={{ background: c.color + '22' }}>{c.icon}</div>
      <div className="mid">
        <div className="t1">{t.merchant || t.note || c.name}</div>
        <div className="t2">
          {c.name} · {fmtDate(t.date)}
          {t.mode ? ' · ' + t.mode : ''}
          {t.source === 'sms' ? ' · 📋' : ''}
        </div>
      </div>
      <div className={'amt num ' + (credit ? 'good' : '')}>{credit ? '+' : '−'}{money(t.amount)}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Empty({ icon = '🧾', title, children }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <div style={{ fontWeight: 600, marginTop: 6 }}>{title}</div>
      {children && <div className="small" style={{ marginTop: 4 }}>{children}</div>}
    </div>
  );
}
