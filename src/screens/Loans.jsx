import { useMemo, useState } from 'react';
import { useApp, Sheet, Empty } from '../components/ui.jsx';
import { calcEmi, loanStatus, schedule } from '../lib/loan.js';
import { money, fmtDate, toInputDate, uid } from '../lib/format.js';
import { ask } from '../lib/ask.js';
import { udharStatus } from '../lib/udhar.js';
import Udhar from './Udhar.jsx';

const TYPES = { home: '🏠 Home', car: '🚗 Vehicle', personal: '👤 Personal', education: '🎓 Education', gold: '🪙 Gold', card: '💳 Card EMI', consumer: '📱 Consumer durable', other: '📄 Other' };

export default function Loans() {
  const { loanTab, setLoanTab, udhar } = useApp();
  const open = udhar.filter((u) => !udharStatus(u).settled).length;
  return (
    <>
      <div className="topbar"><h1>EMI / Udhar</h1></div>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={loanTab !== 'udhar' ? 'on' : ''} onClick={() => setLoanTab('loans')}>📅 EMI / Installments</button>
        <button className={loanTab === 'udhar' ? 'on' : ''} onClick={() => setLoanTab('udhar')}>🤝 Udhar{open ? ` (${open})` : ''}</button>
      </div>
      {loanTab === 'udhar' ? <Udhar /> : <LoanList />}
    </>
  );
}

function LoanList() {
  const { loans, store, notify } = useApp();
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);

  const rows = useMemo(() => loans.map((l) => ({ l, s: loanStatus(l) })), [loans]);
  const active = rows.filter((r) => !r.l.closed && r.s.remaining > 0);
  const totalOut = active.reduce((a, r) => a + r.s.outstanding, 0);
  const monthlyEmi = active.reduce((a, r) => a + r.s.emi, 0);

  const markPaid = async (l, s) => {
    if (!s.next) return;
    const n = s.paid + 1;
    await store.update('loans', l.id, { paidCount: n, closed: n >= s.total });
    await store.add('expenses', {
      id: `emi_${l.id}_${n}`, amount: Math.round(s.next.emi * 100) / 100, type: 'debit', category: 'emi', mode: 'Auto-debit',
      merchant: l.lender || l.name, note: `${l.name} EMI ${n}/${s.total}`, date: Math.min(Date.now(), Math.max(s.next.due, Date.now() - 864e5 * 40)), source: 'loan', loanId: l.id,
    });
    notify(`EMI ${n}/${s.total} marked paid & added to expenses`);
  };

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="small muted">Monthly EMIs and installments with a fixed schedule</span>
        <button className="btn primary small" onClick={() => setEdit({})}>＋ Add EMI</button>
      </div>
      <div className="card hero">
        <div className="muted small">Total outstanding</div>
        <div className="big num">{money(totalOut)}</div>
        <div className="kpis">
          <div className="kpi"><b className="num">{money(monthlyEmi)}</b><span>Monthly EMI</span></div>
          <div className="kpi"><b>{active.length}</b><span>Active EMIs</span></div>
          <div className="kpi"><b className="num">{money(active.reduce((a, r) => a + (r.s.totalInterest - r.s.interestPaid), 0))}</b><span>Interest left</span></div>
        </div>
      </div>
      {!rows.length && <div className="card"><Empty icon="📅" title="No EMIs added">Track home, vehicle, phone, card or any monthly installment. See the balance left, due dates and interest.</Empty></div>}
      <div className="grid2">
        {rows.map(({ l, s }) => {
          const days = s.next ? Math.ceil((s.next.due - Date.now()) / 864e5) : null;
          return (
            <div className="card" key={l.id}>
              <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setView(l)}>
                <div>
                  <h3>{l.name}</h3>
                  <div className="small muted">{TYPES[l.type] || ''}{l.lender ? ' · ' + l.lender : ''} · {l.rate}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b className="num">{money(s.emi)}</b><div className="xs muted">per month</div>
                </div>
              </div>
              <div className="bar" style={{ margin: '12px 0 6px' }}><i style={{ width: s.progress * 100 + '%' }} /></div>
              <div className="row between xs muted"><span>{s.paid}/{s.total} EMIs paid</span><span className="num">{money(s.outstanding)} left</span></div>
              {s.next ? (
                <div className="row between" style={{ marginTop: 12 }}>
                  <span className={'small ' + (s.overdue ? 'bad' : days <= 3 ? 'warn' : 'muted')}>
                    {s.overdue ? `⚠ ${s.overdue} EMI overdue` : `Next: ${fmtDate(s.next.due)} (${days === 0 ? 'today' : days > 0 ? `in ${days}d` : `${-days}d ago`})`}
                  </span>
                  <button className="btn small" onClick={() => markPaid(l, s)}>✓ Mark paid</button>
                </div>
              ) : <div className="small good" style={{ marginTop: 12 }}>🎉 All installments paid</div>}
            </div>
          );
        })}
      </div>
      {edit && <LoanForm initial={edit} onClose={() => setEdit(null)} />}
      {view && <LoanDetail loan={loans.find((x) => x.id === view.id) || view} onClose={() => setView(null)} onEdit={() => { setEdit(view); setView(null); }} />}
    </>
  );
}

function LoanForm({ initial, onClose }) {
  const { store, notify } = useApp();
  const [f, setF] = useState({ name: '', type: 'personal', lender: '', principal: '', rate: '', tenure: '', startDate: toInputDate(Date.now()), emiDay: new Date().getDate(), paidCount: 0, emi: '', ...initial });
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const autoEmi = calcEmi(f.principal, f.rate, f.tenure);
  const elapsed = (() => { const s = new Date(f.startDate), n = new Date(); return Math.max(0, (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth() + (n.getDate() >= (+f.emiDay || 1) ? 1 : 0)); })();

  const save = async (e) => {
    e.preventDefault();
    if (!f.name || !(+f.principal > 0) || !(+f.tenure > 0)) return notify('Fill name, amount and tenure');
    const rec = { ...f, id: f.id || uid(), principal: +f.principal, rate: +f.rate || 0, tenure: +f.tenure, emiDay: +f.emiDay || 1, paidCount: Math.min(+f.paidCount || 0, +f.tenure), emi: +f.emi || 0, date: new Date(f.startDate).getTime() };
    await (initial.id ? store.update('loans', rec.id, rec) : store.add('loans', rec));
    notify('EMI saved'); onClose();
  };

  return (
    <Sheet title={initial.id ? 'Edit EMI' : 'Add EMI / installment'} onClose={onClose}>
      <form onSubmit={save}>
        <label className="field"><span>EMI name</span><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Home loan, iPhone EMI" autoFocus /></label>
        <div className="row">
          <label className="field" style={{ flex: 1 }}><span>Type</span><select className="input" value={f.type} onChange={set('type')}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field" style={{ flex: 1 }}><span>Lender</span><input className="input" value={f.lender} onChange={set('lender')} placeholder="HDFC, Bajaj…" /></label>
        </div>
        <div className="row">
          <label className="field" style={{ flex: 1.3 }}><span>Total amount financed</span><input className="input" inputMode="decimal" value={f.principal} onChange={set('principal')} placeholder="500000" /></label>
          <label className="field" style={{ flex: 1 }}><span>Interest % p.a.</span><input className="input" inputMode="decimal" value={f.rate} onChange={set('rate')} placeholder="10.5" /></label>
          <label className="field" style={{ flex: 1 }}><span>Months</span><input className="input" inputMode="numeric" value={f.tenure} onChange={set('tenure')} placeholder="60" /></label>
        </div>
        <div className="row">
          <label className="field" style={{ flex: 1.3 }}><span>First EMI date</span><input className="input" type="date" value={f.startDate} onChange={(e) => setF((o) => ({ ...o, startDate: e.target.value, emiDay: new Date(e.target.value).getDate() }))} /></label>
          <label className="field" style={{ flex: 1 }}><span>EMIs already paid</span><input className="input" inputMode="numeric" value={f.paidCount} onChange={set('paidCount')} /></label>
        </div>
        {elapsed > 0 && +f.paidCount !== Math.min(elapsed, +f.tenure || elapsed) && (
          <button type="button" className="btn ghost small" style={{ marginTop: -6, marginBottom: 8 }} onClick={() => setF((o) => ({ ...o, paidCount: Math.min(elapsed, +o.tenure || elapsed) }))}>
            Set to {Math.min(elapsed, +f.tenure || elapsed)} (based on start date)
          </button>
        )}
        <label className="field"><span>EMI amount (leave blank to auto-calculate)</span>
          <input className="input" inputMode="decimal" value={f.emi} onChange={set('emi')} placeholder={autoEmi ? 'Auto: ' + money(autoEmi) : 'Auto'} />
        </label>
        {autoEmi > 0 && (
          <div className="card" style={{ background: 'var(--soft)', boxShadow: 'none' }}>
            <div className="row between small"><span>Monthly EMI</span><b className="num">{money(+f.emi || autoEmi)}</b></div>
            <div className="row between small"><span>Total interest</span><b className="num">{money((+f.emi || autoEmi) * f.tenure - f.principal)}</b></div>
            <div className="row between small"><span>Total payable</span><b className="num">{money((+f.emi || autoEmi) * f.tenure)}</b></div>
          </div>
        )}
        <button className="btn primary block">Save EMI</button>
      </form>
    </Sheet>
  );
}

function LoanDetail({ loan, onClose, onEdit }) {
  const { store, notify } = useApp();
  const s = loanStatus(loan);
  const rows = schedule(loan);
  const del = async () => { if (await ask('Delete this EMI?', 'Delete')) { await store.remove('loans', loan.id); notify('EMI deleted'); onClose(); } };
  return (
    <Sheet title={loan.name} onClose={onClose}>
      <div className="kpis" style={{ marginTop: 0, gridTemplateColumns: 'repeat(2,1fr)' }}>
        {[['EMI', money(s.emi)], ['Outstanding', money(s.outstanding)], ['Interest paid', money(s.interestPaid)], ['Total interest', money(s.totalInterest)], ['Paid', `${s.paid} of ${s.total}`], ['Ends', s.endDate ? fmtDate(s.endDate, { month: 'short', year: 'numeric' }) : '-']].map(([k, v]) => (
          <div key={k} className="kpi" style={{ background: 'var(--soft)' }}><b className="num">{v}</b><span className="muted">{k}</span></div>
        ))}
      </div>
      <h3 style={{ margin: '16px 0 8px' }}>Repayment schedule</h3>
      <div style={{ maxHeight: 280, overflow: 'auto' }}>
        <table className="sched num">
          <thead><tr><th>#</th><th>Due</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.no} style={{ opacity: r.no <= s.paid ? 0.45 : 1 }}>
                <td>{r.no <= s.paid ? '✓' : r.no}</td><td>{fmtDate(r.due, { month: 'short', year: '2-digit' })}</td>
                <td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn danger" onClick={del}>Delete</button>
        {s.paid > 0 && <button className="btn" onClick={() => store.update('loans', loan.id, { paidCount: s.paid - 1, closed: false })}>Undo last EMI</button>}
        <button className="btn primary" style={{ flex: 1 }} onClick={onEdit}>Edit</button>
      </div>
    </Sheet>
  );
}
