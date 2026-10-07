import { useMemo, useState } from 'react';
import { useApp, Sheet, Empty } from '../components/ui.jsx';
import { udharStatus, udharTotals, dueLabel } from '../lib/udhar.js';
import { money, fmtDate, toInputDate, uid } from '../lib/format.js';
import { ask } from '../lib/ask.js';

const tone = (s) => (s.settled ? 'good' : s.overdue ? 'bad' : s.daysToDue != null && s.daysToDue <= 2 ? 'warn' : 'muted');

export default function Udhar() {
  const { udhar } = useApp();
  const [filter, setFilter] = useState('open');
  const [edit, setEdit] = useState(null);
  const [pay, setPay] = useState(null);

  const t = useMemo(() => udharTotals(udhar), [udhar]);
  const list = useMemo(() => udhar
    .map((u) => ({ u, s: udharStatus(u) }))
    .filter(({ u, s }) => filter === 'settled' ? s.settled : !s.settled && (filter === 'open' || (filter === 'given' ? u.direction === 'given' : u.direction === 'taken')))
    .sort((a, b) => (a.s.settled - b.s.settled) || ((a.s.due ?? 9e15) - (b.s.due ?? 9e15))), [udhar, filter]);

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="small muted">Money lent to or borrowed from people</span>
        <button className="btn primary small" style={{ flex: 'none' }} onClick={() => setEdit({})}>＋ Add</button>
      </div>

      <div className="card hero">
        <div className="muted small">Net position</div>
        <div className="big num">{t.net >= 0 ? '+' : '−'}{money(Math.abs(t.net))}</div>
        <div className="kpis">
          <div className="kpi"><b className="num">{money(t.receivable)}</b><span>📥 To collect</span></div>
          <div className="kpi"><b className="num">{money(t.payable)}</b><span>📤 To pay</span></div>
          <div className="kpi"><b>{t.overdue}</b><span>Overdue</span></div>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {[['open', 'All open'], ['given', '📥 To collect'], ['taken', '📤 To pay'], ['settled', '✓ Settled']].map(([k, l]) => (
          <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {!list.length ? (
        <div className="card">
          <Empty icon="🤝" title={filter === 'settled' ? 'Nothing settled yet' : 'No open Udhar'}>
            Add money you gave to a friend or took from someone. Set a due date and you get a reminder on that day.
          </Empty>
        </div>
      ) : (
        <div className="grid2">
          {list.map(({ u, s }) => {
            const given = u.direction === 'given';
            return (
              <div className="card" key={u.id}>
                <div className="row between" style={{ cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => setEdit(u)}>
                  <div className="row" style={{ minWidth: 0 }}>
                    <div className="tx" style={{ padding: 0, border: 0 }}><div className="av" style={{ background: 'var(--soft)' }}>{given ? '📥' : '📤'}</div></div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.person}</h3>
                      <div className="xs muted">{given ? 'You gave' : 'You took'} {money(u.amount)} · {fmtDate(u.date)}{u.note ? ' · ' + u.note : ''}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <b className={'num ' + (given ? 'good' : 'bad')}>{money(s.settled ? u.amount : s.outstanding)}</b>
                    <div className="xs muted">{s.settled ? 'settled' : given ? 'to collect' : 'to pay'}</div>
                  </div>
                </div>
                {s.paid > 0 && !s.settled && (
                  <>
                    <div className="bar" style={{ margin: '12px 0 4px' }}><i style={{ width: (s.paid / u.amount) * 100 + '%' }} /></div>
                    <div className="xs muted">{money(s.paid)} {given ? 'received' : 'repaid'} so far</div>
                  </>
                )}
                <div className="row between" style={{ marginTop: 12, gap: 8 }}>
                  <span className={'small ' + tone(s)}>
                    {s.settled ? '✓ Settled' : (s.overdue ? '⚠ ' : '🔔 ') + dueLabel(s.daysToDue) + (s.due ? ` · ${fmtDate(s.due)}` : '')}
                  </span>
                  {!s.settled && <button className="btn small" onClick={() => setPay({ u, s })}>{given ? '✓ Got money' : '✓ Paid'}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && <UdharForm initial={edit} onClose={() => setEdit(null)} />}
      {pay && <PaymentForm u={pay.u} s={pay.s} onClose={() => setPay(null)} />}
    </>
  );
}

function UdharForm({ initial, onClose }) {
  const { store, notify, settings } = useApp();
  const isNew = !initial.id;
  const [f, setF] = useState({
    person: '', phone: '', direction: 'given', amount: '', lentOn: toInputDate(Date.now()),
    dueDate: toInputDate(Date.now() + 30 * 864e5), note: '', payments: [], ...initial,
  });
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const s = udharStatus({ ...f, amount: +f.amount || 0 });

  const save = async (e) => {
    e.preventDefault();
    if (!f.person.trim() || !(+f.amount > 0)) return notify('Enter person name and amount');
    const rec = {
      ...f, id: f.id || uid(), person: f.person.trim(), amount: +f.amount,
      date: new Date(f.lentOn + 'T12:00:00').getTime(), settled: s.paid >= +f.amount - 0.5 || !!f.settled,
    };
    await (isNew ? store.add('udhar', rec) : store.update('udhar', rec.id, rec));
    notify(isNew ? (rec.dueDate && settings.remindersOn ? `Saved · reminder on ${fmtDate(new Date(rec.dueDate))}` : 'Saved') : 'Updated');
    onClose();
  };
  const del = async () => { if (await ask('Delete this Udhar entry?', 'Delete')) { await store.remove('udhar', f.id); notify('Deleted'); onClose(); } };
  const removePayment = (pid) => setF((o) => ({ ...o, payments: o.payments.filter((p) => p.id !== pid), settled: false }));
  const reopen = () => setF((o) => ({ ...o, settled: false }));

  return (
    <Sheet title={isNew ? 'Add Udhar' : 'Udhar details'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="seg" style={{ marginBottom: 12 }}>
          <button type="button" className={f.direction === 'given' ? 'on' : ''} onClick={() => setF((o) => ({ ...o, direction: 'given' }))}>📥 I gave · to collect</button>
          <button type="button" className={f.direction === 'taken' ? 'on' : ''} onClick={() => setF((o) => ({ ...o, direction: 'taken' }))}>📤 I took · to pay</button>
        </div>
        <label className="field"><span>{f.direction === 'given' ? 'Given to' : 'Taken from'}</span>
          <input id="udhar-person" className="input" autoFocus={isNew} value={f.person} onChange={set('person')} placeholder="Person's name" />
        </label>
        <div className="row">
          <label className="field" style={{ flex: 1 }}><span>Amount</span><input id="udhar-amount" className="input" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="5000" /></label>
          <label className="field" style={{ flex: 1 }}><span>Mobile (optional)</span><input id="udhar-phone" className="input" type="tel" value={f.phone} onChange={set('phone')} placeholder="98765 43210" /></label>
        </div>
        <div className="row">
          <label className="field" style={{ flex: 1 }}><span>Date</span><input id="udhar-date" className="input" type="date" value={f.lentOn} onChange={set('lentOn')} /></label>
          <label className="field" style={{ flex: 1 }}><span>Due date 🔔</span><input id="udhar-due" className="input" type="date" value={f.dueDate} onChange={set('dueDate')} /></label>
        </div>
        <div className="chips" style={{ marginTop: -4, marginBottom: 12 }}>
          {[['1 week', 7], ['15 days', 15], ['1 month', 30], ['3 months', 90]].map(([l, d]) => (
            <button type="button" key={l} className="chip" onClick={() => setF((o) => ({ ...o, dueDate: toInputDate(new Date(o.lentOn + 'T12:00:00').getTime() + d * 864e5) }))}>{l}</button>
          ))}
          <button type="button" className="chip" onClick={() => setF((o) => ({ ...o, dueDate: '' }))}>No due date</button>
        </div>
        <label className="field"><span>Note</span><input id="udhar-note" className="input" value={f.note} onChange={set('note')} placeholder="What was it for?" /></label>

        {!isNew && f.payments?.length > 0 && (
          <div className="card" style={{ background: 'var(--soft)', boxShadow: 'none' }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>{f.direction === 'given' ? 'Received back' : 'Repaid'}</div>
            {f.payments.map((p) => (
              <div key={p.id} className="row between small" style={{ padding: '4px 0' }}>
                <span>{fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="row"><b className="num">{money(p.amount)}</b><button type="button" className="btn ghost xs" onClick={() => removePayment(p.id)} aria-label="Remove payment">✕</button></span>
              </div>
            ))}
            <div className="row between small" style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 4 }}><span>Outstanding</span><b className="num">{money(s.outstanding)}</b></div>
          </div>
        )}
        {f.settled && <div className="row between small" style={{ marginBottom: 12 }}><span className="good">✓ Marked as settled</span><button type="button" className="btn ghost small" onClick={reopen}>Reopen</button></div>}
        {f.dueDate && settings.remindersOn && <p className="xs muted" style={{ marginTop: 0 }}>🔔 You'll get a reminder {settings.remindDayBefore ? 'a day before and ' : ''}on the due date at {settings.reminderTime}.</p>}
        <div className="row">
          {!isNew && <button type="button" className="btn danger" onClick={del}>Delete</button>}
          <button className="btn primary" style={{ flex: 1 }}>{isNew ? 'Save' : 'Save changes'}</button>
        </div>
      </form>
    </Sheet>
  );
}

function PaymentForm({ u, s, onClose }) {
  const { store, notify } = useApp();
  const given = u.direction === 'given';
  const [amount, setAmount] = useState(String(Math.round(s.outstanding * 100) / 100));
  const [date, setDate] = useState(toInputDate(Date.now()));
  const [nextDue, setNextDue] = useState(u.dueDate || '');

  const save = async (e) => {
    e.preventDefault();
    const a = Math.min(+amount || 0, s.outstanding);
    if (!(a > 0)) return notify('Enter amount');
    const payments = [...(u.payments || []), { id: uid(), amount: a, date: new Date(date + 'T12:00:00').getTime() }];
    const settled = a >= s.outstanding - 0.5;
    await store.update('udhar', u.id, { payments, settled, dueDate: settled ? u.dueDate : nextDue });
    notify(settled ? `✓ Settled with ${u.person}` : `${money(a)} recorded · ${money(s.outstanding - a)} left`);
    onClose();
  };

  return (
    <Sheet title={given ? `Money received from ${u.person}` : `Repaid to ${u.person}`} onClose={onClose}>
      <form onSubmit={save}>
        <p className="small muted" style={{ marginTop: 0 }}>Outstanding: <b className="num">{money(s.outstanding)}</b></p>
        <div className="row">
          <label className="field" style={{ flex: 1 }}><span>Amount</span><input id="pay-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></label>
          <label className="field" style={{ flex: 1 }}><span>Date</span><input id="pay-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <div className="chips" style={{ marginTop: -4, marginBottom: 12 }}>
          <button type="button" className="chip" onClick={() => setAmount(String(s.outstanding))}>Full {money(s.outstanding)}</button>
          <button type="button" className="chip" onClick={() => setAmount(String(Math.round(s.outstanding / 2)))}>Half</button>
        </div>
        {+amount < s.outstanding - 0.5 && (
          <label className="field"><span>New due date for the rest 🔔</span><input id="pay-nextdue" className="input" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></label>
        )}
        <button className="btn primary block">{+amount >= s.outstanding - 0.5 ? 'Mark as settled' : 'Record part payment'}</button>
      </form>
    </Sheet>
  );
}
