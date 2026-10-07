import { useMemo, useState } from 'react';
import { useApp, Empty, Toggle } from '../components/ui.jsx';
import { monthStats, byCategory, byMonth } from '../lib/stats.js';
import { money, monthLabel } from '../lib/format.js';

/** status colour for a spent/limit ratio */
export const budgetTone = (p) => (p > 1 ? 'var(--bad)' : p >= 0.8 ? 'var(--warn)' : 'var(--good)');

/** Category budgets for the current month: [{...cat, limit, spent, pct}] */
export function categoryBudgetRows(settings, catMap, monthList) {
  const spentBy = Object.fromEntries(byCategory(monthList, catMap).map((c) => [c.id, c.value]));
  return Object.entries(settings.catBudgets || {})
    .filter(([id, v]) => v > 0 && catMap[id])
    .map(([id, limit]) => ({ ...catMap[id], id, limit, spent: spentBy[id] || 0, pct: (spentBy[id] || 0) / limit }))
    .sort((a, b) => b.pct - a.pct);
}

export default function Budget() {
  const { settings } = useApp();
  const [tab, setTab] = useState(settings.budgetTab || 'monthly');
  return (
    <>
      <div className="topbar"><h1>Budget</h1></div>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={tab === 'monthly' ? 'on' : ''} onClick={() => setTab('monthly')}>📅 Monthly</button>
        <button className={tab === 'category' ? 'on' : ''} onClick={() => setTab('category')}>🏷️ Category</button>
      </div>
      {tab === 'monthly' ? <Monthly /> : <Category />}
    </>
  );
}

function Monthly() {
  const { expenses, settings, saveSettings, notify } = useApp();
  const [val, setVal] = useState(settings.budget || '');
  const m = useMemo(() => monthStats(expenses), [expenses]);
  const hist = useMemo(() => byMonth(expenses, 6), [expenses]);
  const on = settings.budget > 0;
  const pct = on ? m.spent / settings.budget : 0;
  const daysLeft = m.daysInMonth - m.dayNo + 1;

  const save = (e) => {
    e?.preventDefault();
    const v = Math.max(0, Math.round(+String(val).replace(/,/g, '') || 0));
    saveSettings({ budget: v });
    notify(v ? `Monthly budget set to ${money(v)}` : 'Monthly budget turned off');
  };

  return (
    <>
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div><h3>Monthly budget</h3><div className="small muted">One limit for all spending in a month (optional)</div></div>
          <Toggle checked={on} label="Use monthly budget" onChange={(v) => { if (v) { setVal(val || 30000); saveSettings({ budget: +val || 30000 }); } else saveSettings({ budget: 0 }); }} />
        </div>
        {on && (
          <form onSubmit={save} className="row">
            <input id="monthly-budget" className="input" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 30000" />
            <button className="btn primary">Save</button>
          </form>
        )}
      </div>

      {on ? (
        <>
          <div className="card">
            <div className="row between"><span className="small muted">Spent this month</span><span className="small muted num">{Math.round(pct * 100)}%</span></div>
            <div className="row between" style={{ alignItems: 'baseline', margin: '4px 0 10px' }}>
              <b style={{ fontSize: 26 }} className="num">{money(m.spent)}</b>
              <span className="muted num">of {money(settings.budget)}</span>
            </div>
            <div className="bar" style={{ height: 10 }}><i style={{ width: Math.min(100, pct * 100) + '%', background: budgetTone(pct) }} /></div>
            <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {[
                [pct > 1 ? 'Over by' : 'Left', money(Math.abs(settings.budget - m.spent)), pct > 1 ? 'bad' : 'good'],
                ['Safe per day', money(Math.max(0, settings.budget - m.spent) / Math.max(1, daysLeft)), ''],
                ['Projected', money(m.projected), m.projected > settings.budget ? 'bad' : ''],
              ].map(([k, v, c]) => (
                <div key={k} className="kpi" style={{ background: 'var(--soft)' }}><b className={'num ' + c}>{v}</b><span className="muted">{k}</span></div>
              ))}
            </div>
            <div className="small muted" style={{ marginTop: 10 }}>
              {pct > 1 ? '⚠ You have crossed this month\'s budget.' : m.projected > settings.budget ? `⚠ At ${money(m.perDay)}/day you will cross the budget. Keep daily spend under ${money(Math.max(0, settings.budget - m.spent) / Math.max(1, daysLeft))}.` : `✓ On track · ${daysLeft} day(s) left this month.`}
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Last 6 months</h3>
            {hist.slice().reverse().map((h) => {
              const p = h.spent / settings.budget;
              return (
                <div key={h.key} style={{ padding: '6px 0' }}>
                  <div className="row between small"><span>{monthLabel(h.key)}</span><span className="num">{money(h.spent)} <span className={p > 1 ? 'bad' : 'muted'}>({Math.round(p * 100)}%)</span></span></div>
                  <div className="bar" style={{ marginTop: 4 }}><i style={{ width: Math.min(100, p * 100) + '%', background: budgetTone(p) }} /></div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card"><Empty icon="📅" title="Monthly budget is off">Turn it on to see how much you can safely spend each day.</Empty></div>
      )}
    </>
  );
}

function Category() {
  const { expenses, settings, saveSettings, catMap, notify, setTab, setTxFilter } = useApp();
  const m = useMemo(() => monthStats(expenses), [expenses]);
  const spentBy = useMemo(() => Object.fromEntries(byCategory(m.list, catMap).map((c) => [c.id, c.value])), [m, catMap]);
  const [draft, setDraft] = useState(() => ({ ...(settings.catBudgets || {}) }));
  const cats = settings.categories.filter((c) => !['income', 'transfer', 'udhar'].includes(c.id));
  const rows = categoryBudgetRows(settings, catMap, m.list);
  const totalLimit = rows.reduce((a, r) => a + r.limit, 0);
  const totalSpent = rows.reduce((a, r) => a + r.spent, 0);
  const dirty = JSON.stringify(clean(draft)) !== JSON.stringify(clean(settings.catBudgets || {}));

  const save = () => { saveSettings({ catBudgets: clean(draft) }); notify('Category budgets saved'); };
  const suggest = () => {
    // average of the last 3 full months, rounded up to nearest 500
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth() - 3, 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const sums = {};
    for (const e of expenses) if (e.date >= start && e.date < end && e.type !== 'credit') sums[e.category] = (sums[e.category] || 0) + e.amount;
    const next = {};
    for (const [k, v] of Object.entries(sums)) if (catMap[k] && !['income', 'transfer', 'udhar'].includes(k)) next[k] = Math.ceil(v / 3 / 500) * 500;
    if (!Object.keys(next).length) return notify('Need at least one past month of spending to suggest');
    setDraft(next); notify('Suggested from your last 3 months — review and Save');
  };

  return (
    <>
      {rows.length > 0 && (
        <div className="card">
          <div className="row between"><h3>This month</h3><span className="small muted num">{money(totalSpent)} / {money(totalLimit)}</span></div>
          <div className="small muted" style={{ margin: '2px 0 10px' }}>
            {rows.filter((r) => r.pct > 1).length ? <span className="bad">⚠ {rows.filter((r) => r.pct > 1).length} category over budget</span> : rows.filter((r) => r.pct >= 0.8).length ? <span className="warn">{rows.filter((r) => r.pct >= 0.8).length} category near limit</span> : '✓ All categories within budget'}
          </div>
          <div className="stack">
            {rows.map((r) => (
              <div key={r.id} className="hbar" style={{ cursor: 'pointer' }} onClick={() => { setTxFilter({ category: r.id }); setTab('txns'); }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <div>
                  <div className="row between"><span>{r.name}</span><span className="xs" style={{ color: budgetTone(r.pct) }}>{r.pct > 1 ? `Over ${money(r.spent - r.limit)}` : `${money(r.limit - r.spent)} left`}</span></div>
                  <div className="track" style={{ marginTop: 4 }}><div className="fill" style={{ width: Math.min(100, r.pct * 100) + '%', background: budgetTone(r.pct) }} /></div>
                </div>
                <b className="num small">{Math.round(r.pct * 100)}%</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <div><h3>Set limits</h3><div className="small muted">Leave blank for no limit (optional)</div></div>
          <button className="btn small" onClick={suggest}>✨ Suggest</button>
        </div>
        {cats.map((c) => (
          <div key={c.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 18, width: 26 }}>{c.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small">{c.name}</div>
              <div className="xs muted num">Spent {money(spentBy[c.id] || 0)} this month</div>
            </div>
            <input id={'cb-' + c.id} className="input num" style={{ width: 110, padding: '8px 10px', textAlign: 'right' }} inputMode="numeric" placeholder="No limit"
              value={draft[c.id] || ''} onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value.replace(/\D/g, '') }))} aria-label={c.name + ' budget'} />
          </div>
        ))}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setDraft({})}>Clear all</button>
          <button className="btn primary" style={{ flex: 1 }} disabled={!dirty} onClick={save}>Save category budgets</button>
        </div>
      </div>
    </>
  );
}

function clean(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (+v > 0) out[k] = +v;
  return out;
}
