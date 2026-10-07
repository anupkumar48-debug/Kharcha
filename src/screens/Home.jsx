import { useMemo } from 'react';
import { useApp, TxRow, Empty } from '../components/ui.jsx';
import { CategoryBars } from '../components/Charts.jsx';
import { monthStats, byCategory } from '../lib/stats.js';
import { daysTo } from '../lib/reminders.js';
import { dueLabel } from '../lib/udhar.js';
import { budgetTone, categoryBudgetRows } from './Budget.jsx';
import { money, fmtDate } from '../lib/format.js';
import { lockNow } from '../lib/backend.js';
import { smsSupported } from '../lib/native.js';
import { ask } from '../lib/ask.js';

export default function Home() {
  const { user, expenses, dues, setLoanTab, autoBk, settings, catMap, openAdd, openSms, scanInbox, smsPerm, setTab, setTxFilter, pending } = useApp();
  const autoSms = smsSupported() && settings.smsAuto;
  const m = useMemo(() => monthStats(expenses), [expenses]);
  const last = useMemo(() => { const d = new Date(); return monthStats(expenses, new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime()); }, [expenses]);
  const cats = useMemo(() => byCategory(m.list, catMap), [m, catMap]);
  const catRows = useMemo(() => categoryBudgetRows(settings, catMap, m.list), [settings, catMap, m]);

  const hello = settings.name || user.name || '';
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const budgetPct = settings.budget ? m.spent / settings.budget : 0;
  const vsLast = last.spent ? (m.spent - last.spent * (m.dayNo / last.daysInMonth)) : 0;

  const W = {
    summary: (
      <div className="card hero" key="summary">
        <div className="muted small">Spent in {new Date().toLocaleDateString('en-IN', { month: 'long' })}</div>
        <div className="big num">{money(m.spent)}</div>
        <div className="kpis">
          <div className="kpi"><b className="num">{money(m.income)}</b><span>Income</span></div>
          <div className="kpi"><b className="num">{money(m.perDay)}</b><span>Per day avg</span></div>
          <div className="kpi"><b className="num">{money(m.projected)}</b><span>Projected</span></div>
        </div>
        {last.spent > 0 && (
          <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
            {vsLast > 0 ? '▲' : '▼'} {money(Math.abs(vsLast))} {vsLast > 0 ? 'more' : 'less'} than last month at this point
          </div>
        )}
      </div>
    ),
    budget: (settings.budget > 0 || catRows.length > 0) && (
      <div className="card" key="budget">
        <div className="card-h"><h3>Budget</h3><button className="btn ghost small" onClick={() => setTab('budget')}>Manage →</button></div>
        {settings.budget > 0 && (
          <>
            <div className="row between small"><span>Monthly</span><span className="muted num">{money(m.spent)} / {money(settings.budget)}</span></div>
            <div className="bar" style={{ marginTop: 6 }}><i style={{ width: Math.min(100, budgetPct * 100) + '%', background: budgetTone(budgetPct) }} /></div>
            <div className="small" style={{ marginTop: 6 }}>
              {budgetPct > 1 ? <span className="bad">⚠ Over budget by {money(m.spent - settings.budget)}</span>
                : <span className="muted">{money(settings.budget - m.spent)} left · {money((settings.budget - m.spent) / Math.max(1, m.daysInMonth - m.dayNo + 1))}/day for {m.daysInMonth - m.dayNo + 1} days</span>}
            </div>
          </>
        )}
        {catRows.length > 0 && (
          <div className="stack" style={{ marginTop: settings.budget > 0 ? 14 : 0 }}>
            {catRows.slice(0, 3).map((r) => (
              <div key={r.id} className="hbar">
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <div>
                  <div className="row between xs"><span>{r.name}</span><span className="muted num">{money(r.spent)} / {money(r.limit)}</span></div>
                  <div className="track" style={{ marginTop: 3, height: 6 }}><div className="fill" style={{ width: Math.min(100, r.pct * 100) + '%', background: budgetTone(r.pct) }} /></div>
                </div>
                <span className="xs num" style={{ color: budgetTone(r.pct), fontWeight: 700 }}>{Math.round(r.pct * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    sms: (
      <div className="card" key="sms">
        <div className="row between">
          <div>
            <h3>{autoSms ? '📩 Bank SMS' : '📋 Add from bank SMS'}</h3>
            <div className="small muted">{pending.length ? `${pending.length} transaction(s) to review`
              : autoSms ? (smsPerm === 'granted' ? 'New bank SMS are added automatically when you open the app' : 'Tap Read SMS and allow SMS access once')
              : 'Copy a bank or UPI SMS and paste it here'}</div>
          </div>
          {pending.length ? <button className="btn primary" onClick={openSms}>Review</button>
            : autoSms ? <button className="btn primary" onClick={scanInbox}>Read SMS</button>
            : <button className="btn primary" onClick={openSms}>Paste SMS</button>}
        </div>
      </div>
    ),
    upcoming: dues.length > 0 && (
      <div className="card" key="upcoming">
        <div className="card-h"><h3>🔔 Upcoming dues</h3><button className="btn ghost small" onClick={() => setTab('loans')}>All →</button></div>
        {dues.slice(0, 4).map((d) => {
          const days = daysTo(d.due);
          return (
            <div className="tx click" key={d.key} onClick={() => { setLoanTab(d.kind === 'udhar' ? 'udhar' : 'loans'); setTab('loans'); }}>
              <div className="av" style={{ background: 'var(--soft)' }}>{d.icon}</div>
              <div className="mid"><div className="t1">{d.title}</div><div className="t2">{fmtDate(d.due)} · {d.sub}</div></div>
              <div style={{ textAlign: 'right' }}>
                <div className={'amt num ' + (d.dir === 'receivable' ? 'good' : '')}>{d.dir === 'receivable' ? '+' : '−'}{money(d.amount)}</div>
                <div className={'xs ' + (days < 0 ? 'bad' : days <= 2 ? 'warn' : 'muted')}>{dueLabel(days)}</div>
              </div>
            </div>
          );
        })}
      </div>
    ),
    categories: (
      <div className="card" key="categories">
        <div className="card-h"><h3>Where it went</h3><button className="btn ghost small" onClick={() => setTab('trends')}>Trends →</button></div>
        <CategoryBars items={cats} total={m.spent} limit={5} onPick={(id) => { setTxFilter({ category: id }); setTab('txns'); }} />
      </div>
    ),
    recent: (
      <div className="card" key="recent">
        <div className="card-h"><h3>Recent</h3><button className="btn ghost small" onClick={() => setTab('txns')}>See all →</button></div>
        {expenses.length ? expenses.slice(0, 6).map((t) => <TxRow key={t.id} t={t} onClick={() => openAdd(t)} />)
          : <Empty title="No transactions yet">Tap ＋ to add your first expense, or paste a bank SMS.</Empty>}
      </div>
    ),
  };

  const order = settings.widgets.filter((w) => !settings.hiddenWidgets.includes(w) && W[w]);
  return (
    <>
      <div className="topbar">
        <div><div className="small muted">{greet}{hello ? ',' : ''}</div><h1>{hello || 'Welcome'} 👋</h1></div>
        {user.hasPin && <button className="btn ghost small" onClick={lockNow} aria-label="Lock app">🔒 Lock</button>}
      </div>
      {expenses.length >= 10 && Date.now() - Math.max(settings.lastBackup || 0, (autoBk?.status !== 'error' && autoBk?.at) || 0) > 7 * 864e5 && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <div className="row between">
            <div><h3>💾 Time for a backup</h3><div className="small muted">{settings.autoBackup ? (autoBk?.status === 'needs-folder' ? 'Choose a folder once to turn on daily auto-backup.' : autoBk?.status === 'needs-permission' ? 'Tap to continue daily auto-backup.' : 'Auto-backup has not run for a week.') : 'Your data lives only on this device and has not been backed up for a week.'}</div></div>
            <button className="btn primary" onClick={() => setTab('settings')}>Back up</button>
          </div>
        </div>
      )}
      {order.map((w) => W[w])}
    </>
  );
}
