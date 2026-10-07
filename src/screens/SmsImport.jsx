import { useEffect, useRef, useState } from 'react';
import { Sheet, useApp, Empty } from '../components/ui.jsx';
import { parseMany } from '../lib/smsParser.js';
import { money, fmtDate } from '../lib/format.js';
import { readClipboard, smsSupported } from '../lib/native.js';

const SAMPLE = `Rs.450.00 debited from A/c XX1234 on 05-10-26 to VPA swiggy@icici (UPI Ref No 627812345678).

INR 2,500.00 spent on HDFC Bank Card XX4321 at AMAZON on 2026-10-05. Avl Lmt: INR 1,22,000.00

Rs 15,000.00 credited to your A/c XX7788 by NEFT from ACME CORP. Avl Bal Rs 45,210.55`;

export default function SmsImport({ onClose }) {
  const { pending, setPending, ingest, store, settings, saveSettings, catMap, notify, readSms } = useApp();
  const [text, setText] = useState('');
  const [sel, setSel] = useState(() => new Set(pending.map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  // select newly found items (e.g. after "Read new SMS from inbox")
  const seenIds = useRef(new Set(pending.map((p) => p.id)));
  useEffect(() => {
    const add = pending.filter((p) => !seenIds.current.has(p.id)).map((p) => p.id);
    if (add.length) { add.forEach((id) => seenIds.current.add(id)); setSel((s) => new Set([...s, ...add])); }
  }, [pending]);

  const parse = async () => {
    const parsed = parseMany(text);
    if (!parsed.length) return notify('No bank transaction found in the text');
    const n = await ingest(parsed);
    setSel((s) => new Set([...s, ...parsed.map((p) => p.smsId)]));
    setText('');
    notify(n ? `Found ${n} new transaction(s)` : 'Already imported');
  };

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setCat = (id, category) => setPending((list) => list.map((p) => (p.id === id ? { ...p, category } : p)));

  const importSel = async () => {
    setBusy(true);
    const chosen = pending.filter((p) => sel.has(p.id));
    const skipped = pending.filter((p) => !sel.has(p.id)).map((p) => p.smsId);
    await store.bulkAdd('expenses', chosen);
    if (skipped.length) await saveSettings({ ignoredSms: [...(settings.ignoredSms || []), ...skipped].slice(-3000) });
    setPending([]);
    setBusy(false);
    notify(`Added ${chosen.length} transaction(s)`);
    onClose();
  };

  const pasteClipboard = async () => {
    const t = await readClipboard();
    if (!t.trim()) return notify('Nothing copied yet — copy a bank SMS, or long-press the box below and Paste');
    setText((cur) => (cur.trim() ? cur.trim() + '\n\n' : '') + t.trim());
  };

  return (
    <Sheet title="Add from bank SMS" onClose={onClose}>
      {smsSupported() && (
        <button className="btn primary block" style={{ marginBottom: 12 }} onClick={() => readSms({ manual: 'review' })}>📥 Read new SMS from inbox</button>
      )}
      <ol className="small muted" style={{ margin: '0 0 10px', paddingLeft: 18 }}>
        <li>Open your SMS app and copy a bank / UPI / card message (you can copy several).</li>
        <li>Paste it below and tap <b>Find transactions</b>.</li>
      </ol>
      <textarea id="sms-paste" className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Paste one or more bank SMS here" />
      <div className="row wrap" style={{ marginTop: 8 }}>
        <button className="btn" onClick={pasteClipboard}>📋 Paste</button>
        <button className="btn" onClick={() => setText(SAMPLE)}>Try sample</button>
        <button className="btn primary" style={{ flex: 1 }} disabled={!text.trim()} onClick={parse}>Find transactions</button>
      </div>

      {pending.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="row between small" style={{ marginBottom: 6 }}>
            <b>{pending.length} found · {sel.size} selected</b>
            <button className="btn ghost small" onClick={() => setSel(sel.size === pending.length ? new Set() : new Set(pending.map((p) => p.id)))}>
              {sel.size === pending.length ? 'Select none' : 'Select all'}
            </button>
          </div>
          {pending.map((p) => (
            <div key={p.id} className="tx" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} style={{ marginTop: 12, width: 18, height: 18 }} aria-label={'Select ' + (p.merchant || 'transaction')} />
              <div className="mid">
                <div className="t1">{p.merchant || p.bank || 'Unknown'}</div>
                <div className="t2">{fmtDate(p.date)} · {p.mode}{p.account ? ' · ••' + p.account : ''}{p.bank ? ' · ' + p.bank : ''}</div>
                <select className="input" style={{ padding: '6px 8px', marginTop: 6, fontSize: 13 }} value={p.category} onChange={(e) => setCat(p.id, e.target.value)}>
                  {settings.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className={'amt num ' + (p.type === 'credit' ? 'good' : '')}>{p.type === 'credit' ? '+' : '−'}{money(p.amount)}</div>
            </div>
          ))}
          <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy || !sel.size} onClick={importSel}>Add {sel.size} transaction(s)</button>
        </div>
      )}
      <p className="xs muted" style={{ marginTop: 12 }}>🔒 SMS are read only on this phone. Only the amount, merchant, payment mode, account last 4 digits and date are saved.</p>
    </Sheet>
  );
}
