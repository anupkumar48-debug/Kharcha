import { useMemo, useState } from 'react';
import { useApp, TxRow, Empty } from '../components/ui.jsx';
import { money, monthKey, monthLabel, fmtDate } from '../lib/format.js';
import { isSpend } from '../lib/stats.js';
import { exportText } from '../lib/backup.js';

export default function Transactions() {
  const { expenses, settings, catMap, openAdd, txFilter, setTxFilter, openSms } = useApp();
  const [month, setMonth] = useState(monthKey(Date.now()));
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const cat = txFilter?.category || 'all';

  const months = useMemo(() => {
    const s = new Set([monthKey(Date.now()), ...expenses.map((e) => monthKey(e.date))]);
    return [...s].sort().reverse();
  }, [expenses]);

  const list = useMemo(() => expenses.filter((e) =>
    (month === 'all' || monthKey(e.date) === month) &&
    (cat === 'all' || e.category === cat) &&
    (type === 'all' || (type === 'sms' ? e.source === 'sms' : e.type === type)) &&
    (!q || `${e.merchant} ${e.note} ${catMap[e.category]?.name} ${e.amount}`.toLowerCase().includes(q.toLowerCase()))
  ), [expenses, month, cat, type, q, catMap]);

  const spent = list.filter(isSpend).reduce((a, x) => a + x.amount, 0);
  const income = list.filter((x) => x.type === 'credit').reduce((a, x) => a + x.amount, 0);

  const groups = useMemo(() => {
    const g = [];
    for (const t of list) {
      const k = new Date(t.date).toDateString();
      if (!g.length || g[g.length - 1].k !== k) g.push({ k, date: t.date, items: [] });
      g[g.length - 1].items.push(t);
    }
    return g;
  }, [list]);

  const exportCsv = () => {
    const head = ['Date', 'Type', 'Amount', 'Category', 'Merchant', 'Mode', 'Note', 'Source'];
    const rows = list.map((e) => [new Date(e.date).toISOString().slice(0, 10), e.type, e.amount, catMap[e.category]?.name, e.merchant, e.mode, e.note, e.source]);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    exportText(`kharcha-${month}.csv`, csv).catch(() => {});
  };

  return (
    <>
      <div className="topbar">
        <h1>Expenses</h1>
        <div className="row">
          <button className="btn small" onClick={openSms}>📋 Paste SMS</button>
          <button className="btn small" onClick={exportCsv} disabled={!list.length}>⬇ CSV</button>
        </div>
      </div>
      <div className="card">
        <div className="row wrap" style={{ gap: 8 }}>
          <select className="input" style={{ flex: '1 1 140px' }} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All time</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <input className="input" style={{ flex: '2 1 180px' }} placeholder="🔍 Search merchant, note, amount" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {[['all', 'All'], ['debit', 'Expenses'], ['credit', 'Income'], ['sms', '📋 From SMS']].map(([k, l]) => (
            <button key={k} className={'chip' + (type === k ? ' on' : '')} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setTxFilter(null)}>All categories</button>
          {settings.categories.map((c) => (
            <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setTxFilter({ category: c.id })}>{c.icon} {c.name}</button>
          ))}
        </div>
        <div className="row between small" style={{ marginTop: 12 }}>
          <span className="muted">{list.length} transactions</span>
          <span className="num"><span className="bad">−{money(spent)}</span>{income > 0 && <> · <span className="good">+{money(income)}</span></>}</span>
        </div>
      </div>
      <div className="card">
        {groups.length ? groups.map((g) => (
          <div key={g.k}>
            <div className="dayhead">{fmtDate(g.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            {g.items.map((t) => <TxRow key={t.id} t={t} onClick={() => openAdd(t)} />)}
          </div>
        )) : <Empty title="No transactions match">Change filters or tap ＋ to add one.</Empty>}
      </div>
    </>
  );
}
