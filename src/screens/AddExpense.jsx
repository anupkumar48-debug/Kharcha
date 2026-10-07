import { useState } from 'react';
import { Sheet, useApp } from '../components/ui.jsx';
import { toInputDate, uid } from '../lib/format.js';
import { ask } from '../lib/ask.js';

const MODES = ['UPI', 'Card', 'Cash', 'Net Banking', 'Auto-debit', 'Bank', 'Wallet'];

export default function AddExpense({ initial, onClose }) {
  const { store, settings, saveSettings, notify } = useApp();
  const editing = !!initial?.id;
  const [f, setF] = useState(() => ({
    type: 'debit', category: 'food', mode: 'UPI', merchant: '', note: '', amount: '', date: Date.now(), ...initial,
  }));
  const [dateStr, setDateStr] = useState(toInputDate(f.date));
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const cats = settings.categories.filter((c) => (f.type === 'credit' ? true : c.id !== 'income'));

  const save = async (e) => {
    e?.preventDefault();
    const amount = parseFloat(String(f.amount).replace(/,/g, ''));
    if (!(amount > 0)) return notify('Enter an amount');
    const now = new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime();
    const rec = { ...f, amount, date, id: f.id || uid(), source: f.source || 'manual' };
    if (editing) await store.update('expenses', rec.id, rec);
    else await store.add('expenses', rec);
    // learn merchant -> category from user corrections
    if (rec.merchant && initial?.category !== rec.category) {
      await saveSettings({ learned: { ...settings.learned, [rec.merchant.toLowerCase()]: rec.category } });
    }
    notify(editing ? 'Updated' : 'Saved');
    onClose();
  };

  const del = async () => {
    if (!(await ask('Delete this transaction?', 'Delete'))) return;
    await store.remove('expenses', f.id);
    if (f.smsId) await saveSettings({ ignoredSms: [...(settings.ignoredSms || []), f.smsId].slice(-3000) });
    notify('Deleted'); onClose();
  };

  return (
    <Sheet title={editing ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="seg" style={{ marginBottom: 10 }}>
          <button type="button" className={f.type === 'debit' ? 'on' : ''} onClick={() => setF((o) => ({ ...o, type: 'debit', category: o.category === 'income' ? 'food' : o.category }))}>Expense</button>
          <button type="button" className={f.type === 'credit' ? 'on' : ''} onClick={() => setF((o) => ({ ...o, type: 'credit', category: 'income' }))}>Income</button>
        </div>
        <input className="amount-in num" autoFocus={!editing} inputMode="decimal" placeholder="₹0" value={f.amount} onChange={set('amount')} aria-label="Amount" />
        <div className="catgrid" style={{ margin: '14px 0' }}>
          {cats.map((c) => (
            <button type="button" key={c.id} className={'catbtn' + (f.category === c.id ? ' on' : '')} onClick={() => set('category')(c.id)}>
              <span className="e">{c.icon}</span>{c.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: 1 }}><span>Date</span><input className="input" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} /></label>
          <label className="field" style={{ flex: 1 }}><span>Paid via</span>
            <select className="input" value={f.mode} onChange={set('mode')}>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
        </div>
        <label className="field"><span>{f.type === 'credit' ? 'From' : 'Paid to'}</span><input className="input" value={f.merchant || ''} onChange={set('merchant')} placeholder="e.g. Swiggy, Landlord" /></label>
        <label className="field"><span>Note</span><input className="input" value={f.note || ''} onChange={set('note')} placeholder="Optional" /></label>
        {f.raw && <details className="small muted" style={{ marginBottom: 12 }}><summary>Original SMS</summary><p>{f.raw}</p></details>}
        <div className="row">
          {editing && <button type="button" className="btn danger" onClick={del}>Delete</button>}
          <button className="btn primary block" style={{ flex: 1 }}>{editing ? 'Save changes' : 'Save'}</button>
        </div>
      </form>
    </Sheet>
  );
}
