import { useMemo, useState } from 'react';
import { useApp, Empty } from '../components/ui.jsx';
import { BarChart, LineChart, CategoryBars } from '../components/Charts.jsx';
import { byMonth, byCategory, monthStats, cumulativeByDay, topMerchants, isSpend } from '../lib/stats.js';
import { money, monthLabel } from '../lib/format.js';

export default function Trends() {
  const { expenses, settings, catMap, setTab, setTxFilter } = useApp();
  const [range, setRange] = useState(6);
  const [offset, setOffset] = useState(0); // month offset for category view

  const months = useMemo(() => byMonth(expenses, range), [expenses, range]);
  const ref = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - offset, 15).getTime(); }, [offset]);
  const cur = useMemo(() => monthStats(expenses, ref), [expenses, ref]);
  const prev = useMemo(() => { const d = new Date(ref); return monthStats(expenses, new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime()); }, [expenses, ref]);
  const cats = useMemo(() => byCategory(cur.list, catMap), [cur, catMap]);
  const prevCats = useMemo(() => Object.fromEntries(byCategory(prev.list, catMap).map((c) => [c.id, c.value])), [prev, catMap]);
  const merchants = useMemo(() => topMerchants(cur.list), [cur]);

  const line = useMemo(() => [
    { name: 'This month', color: 'var(--accent)', values: cumulativeByDay(cur.list, cur.start, cur.daysInMonth, offset ? cur.daysInMonth : cur.dayNo) },
    { name: 'Last month', color: 'var(--muted)', dash: true, values: cumulativeByDay(prev.list, prev.start, cur.daysInMonth, prev.daysInMonth) },
  ], [cur, prev, offset]);

  const insights = useMemo(() => {
    const out = [];
    const withData = months.filter((m) => m.spent > 0);
    if (withData.length >= 2) {
      const avg = withData.reduce((a, m) => a + m.spent, 0) / withData.length;
      out.push(`Average monthly spend over ${withData.length} months: ${money(avg)}.`);
    }
    const changes = cats.map((c) => ({ ...c, d: c.value - (prevCats[c.id] || 0) })).sort((a, b) => b.d - a.d);
    if (changes[0]?.d > 0 && prev.spent > 0) out.push(`${changes[0].icon} ${changes[0].name} up by ${money(changes[0].d)} vs last month.`);
    const down = changes[changes.length - 1];
    if (down && down.d < 0) out.push(`${down.icon} ${down.name} down by ${money(-down.d)} — nice!`);
    if (cur.income > 0) {
      const rate = (cur.income - cur.spent) / cur.income;
      out.push(rate >= 0 ? `You saved ${Math.round(rate * 100)}% of income this month.` : `Spending exceeded income by ${money(cur.spent - cur.income)}.`);
    }
    const wk = cur.list.filter(isSpend).reduce((a, x) => { const d = new Date(x.date).getDay(); a[d === 0 || d === 6 ? 1 : 0] += x.amount; return a; }, [0, 0]);
    if (wk[0] + wk[1] > 0) out.push(`Weekends make up ${Math.round((wk[1] / (wk[0] + wk[1])) * 100)}% of spend.`);
    const emi = cats.find((c) => c.id === 'emi');
    if (emi && cur.spent) out.push(`EMIs take ${Math.round((emi.value / cur.spent) * 100)}% of your spend.`);
    return out;
  }, [months, cats, prevCats, cur, prev]);

  if (!expenses.length) return (<><div className="topbar"><h1>Trends</h1></div><div className="card"><Empty icon="📊" title="No data yet">Add expenses or import SMS to see trends.</Empty></div></>);

  const label = new Date(ref).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <>
      <div className="topbar">
        <h1>Trends</h1>
        <div className="seg" style={{ width: 150 }}>
          {[6, 12].map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}M</button>)}
        </div>
      </div>

      {insights.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>💡 Insights</h3>
          {insights.map((t, i) => <div key={i} className="small" style={{ padding: '4px 0' }}>• {t}</div>)}
        </div>
      )}

      <div className="card">
        <div className="card-h"><h3>Monthly spend</h3><span className="xs muted">dashed = budget</span></div>
        <BarChart data={months.map((m, i) => ({ label: monthLabel(m.key).split(' ')[0], hint: monthLabel(m.key), value: m.spent, highlight: i === months.length - 1 - offset ? true : offset ? false : undefined }))} refLine={settings.budget} />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-h"><h3>Income vs spend</h3></div>
          <table className="sched num">
            <thead><tr><th>Month</th><th>Income</th><th>Spent</th><th>Saved</th></tr></thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.key}><td>{monthLabel(m.key)}</td><td>{money(m.income)}</td><td>{money(m.spent)}</td>
                  <td className={m.income - m.spent >= 0 ? 'good' : 'bad'}>{money(m.income - m.spent)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-h"><h3>Cumulative spend</h3></div>
          <LineChart series={line} days={cur.daysInMonth} />
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <button className="iconbtn" onClick={() => setOffset(offset + 1)} aria-label="Previous month">‹</button>
          <h3>{label} · {money(cur.spent)}</h3>
          <button className="iconbtn" onClick={() => setOffset(Math.max(0, offset - 1))} disabled={!offset} aria-label="Next month">›</button>
        </div>
        <CategoryBars items={cats} total={cur.spent} limit={20} onPick={(id) => { setTxFilter({ category: id }); setTab('txns'); }} />
        {cats.length > 0 && prev.spent > 0 && (
          <div className="xs muted" style={{ marginTop: 10 }}>
            vs last month: {cats.slice(0, 6).map((c) => ({ c, d: c.value - (prevCats[c.id] || 0) })).filter(({ d }) => Math.abs(d) >= 1).map(({ c, d }) => `${c.icon} ${d > 0 ? '▲' : '▼'}${money(Math.abs(d))}`).join('   ') || 'no change'}
          </div>
        )}
      </div>

      {merchants.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Top merchants · {label}</h3>
          {merchants.map((m) => (
            <div key={m.name} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{m.name} <span className="muted">· {m.count}×</span></span><b className="num">{money(m.value)}</b>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
