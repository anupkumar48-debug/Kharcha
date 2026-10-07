import { useEffect, useState } from 'react';
import { useApp, Toggle, Sheet } from '../components/ui.jsx';
import { SCREENS, WIDGETS, DEFAULT_SETTINGS } from '../App.jsx';
import { eraseEverything, setPin, lockNow, setProfileName } from '../lib/backend.js';
import { exportBackup, readBackupFile } from '../lib/backup.js';
import { autoBackupStatus, chooseBackupFolder, resumeBackupFolder, readLatestNativeBackup } from '../lib/autobackup.js';
import { isNative } from '../lib/native.js';
import { uid, fmtDate } from '../lib/format.js';
import { makeSampleData } from '../lib/sample.js';
import { ask } from '../lib/ask.js';
import { reminderPermission, planNotifications } from '../lib/reminders.js';


const ACCENTS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0f172a'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

function SortList({ order, hidden, labels, onChange, locked = [] }) {
  const move = (i, d) => { const o = [...order]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; onChange(o, hidden); };
  const toggle = (k, on) => onChange(order, on ? hidden.filter((h) => h !== k) : [...hidden, k]);
  return order.filter((k) => labels[k]).map((k, i) => (
    <div className="sortrow" key={k}>
      <div className="grow">{labels[k]}</div>
      <button className="iconbtn" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>↑</button>
      <button className="iconbtn" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === order.length - 1}>↓</button>
      {!locked.includes(k) && <Toggle checked={!hidden.includes(k)} onChange={(v) => toggle(k, v)} label={'Show ' + labels[k]} />}
    </div>
  ));
}

export default function Settings() {
  const { user, settings, saveSettings, store, expenses, loans, udhar, notify } = useApp();
  const [catEdit, setCatEdit] = useState(null);
  const s = settings;

  const navLabels = Object.fromEntries(Object.entries(SCREENS).map(([k, v]) => [k, `${v.icon} ${v.label}`]));

  const backup = async () => {
    try {
      const name = await exportBackup({ settings: s, expenses, loans, udhar });
      await saveSettings({ lastBackup: Date.now() });
      notify(isNative() ? 'Backup ready — save it to Drive or send it to yourself' : `Saved ${name} to Downloads`);
    } catch (e) { if (!/cancel/i.test(String(e?.message))) notify('Backup failed: ' + (e?.message || 'try again')); }
  };
  const restoreData = async (data, label = 'backup') => {
    const ok = await ask(`Restore ${label}: ${data.expenses?.length || 0} transactions, ${data.loans?.length || 0} EMIs and ${data.udhar?.length || 0} Udhar entries? Entries with the same ID are replaced; others are kept.`, 'Restore');
    if (!ok) return;
    if (data.expenses) await store.bulkAdd('expenses', data.expenses);
    if (data.loans) await store.bulkAdd('loans', data.loans);
    if (data.udhar) await store.bulkAdd('udhar', data.udhar);
    if (data.settings) await saveSettings({ ...data.settings, lastBackup: s.lastBackup, autoBackup: s.autoBackup });
    notify('Backup restored');
  };
  const restore = async (file) => {
    try {
      const data = await readBackupFile(file);
      return restoreData(data, file.name);
    } catch (e) { notify(e?.message === 'Not a Kharcha backup file' ? e.message : 'Could not read that file'); }
  };
  const loadSample = async () => {
    const { expenses: e, loans: l, udhar: u, catBudgets } = makeSampleData();
    await store.bulkAdd('expenses', e); await store.bulkAdd('loans', l); await store.bulkAdd('udhar', u);
    if (!Object.keys(s.catBudgets || {}).length) await saveSettings({ catBudgets });
    notify('Sample data added');
  };
  const wipe = async () => {
    if (!(await ask('Erase ALL Kharcha data on this device (transactions, budgets, EMIs, Udhar, settings, PIN)? Take a backup first — this cannot be undone.', 'Erase everything'))) return;
    eraseEverything();
  };

  return (
    <>
      <div className="topbar"><h1>Customize</h1></div>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>👤 Profile</h3>
          <label className="field"><span>Your name</span><input className="input" defaultValue={s.name || user.name} onBlur={(e) => { const n = e.target.value.trim(); saveSettings({ name: n }); setProfileName(n); }} placeholder="Shown on Home" /></label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}><span>Currency</span>
              <select className="input" value={s.currency} onChange={(e) => saveSettings({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
          </div>
          <div className="small muted">🔒 Private: data stays on this device</div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>🎨 Look & feel</h3>
          <div className="field"><span className="small muted">Theme</span>
            <div className="seg" style={{ marginTop: 4 }}>
              {[['auto', 'Auto'], ['light', '☀️ Light'], ['dark', '🌙 Dark']].map(([k, l]) => <button key={k} className={s.theme === k ? 'on' : ''} onClick={() => saveSettings({ theme: k })}>{l}</button>)}
            </div>
          </div>
          <div className="field"><span className="small muted">Accent colour</span>
            <div className="swatches" style={{ marginTop: 6 }}>
              {ACCENTS.map((c) => <button key={c} className={'swatch' + (s.accent === c ? ' on' : '')} style={{ background: c }} onClick={() => saveSettings({ accent: c })} aria-label={'Accent ' + c} />)}
              <input type="color" value={s.accent} onChange={(e) => saveSettings({ accent: e.target.value })} style={{ width: 32, height: 32, border: 0, background: 'none', padding: 0 }} aria-label="Custom accent" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>🧭 Menu</h3>
          <p className="small muted" style={{ margin: '4px 0 12px' }}>Reorder or hide tabs in the bottom bar / sidebar.</p>
          <SortList order={s.nav} hidden={s.hiddenNav} labels={navLabels} locked={['settings']} onChange={(nav, hiddenNav) => saveSettings({ nav, hiddenNav })} />
        </div>
        <div className="card">
          <h3>🏠 Home screen</h3>
          <p className="small muted" style={{ margin: '4px 0 12px' }}>Choose which cards appear on Home and in what order.</p>
          <SortList order={s.widgets} hidden={s.hiddenWidgets} labels={WIDGETS} onChange={(widgets, hiddenWidgets) => saveSettings({ widgets, hiddenWidgets })} />
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>🏷️ Categories</h3><button className="btn small" onClick={() => setCatEdit({ id: '', name: '', icon: '🏷️', color: '#6366f1' })}>＋ Add</button></div>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {s.categories.map((c) => (
            <button key={c.id} className="chip" style={{ borderColor: c.color }} onClick={() => setCatEdit(c)}>{c.icon} {c.name}</button>
          ))}
        </div>
        <button className="btn ghost small" style={{ marginTop: 8 }} onClick={async () => (await ask('Reset categories to default?', 'Reset')) && saveSettings({ categories: DEFAULT_SETTINGS.categories })}>Reset to default</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>📋 Bank SMS</h3>
        <div className="small muted">Kharcha never reads your messages. Copy a bank or UPI SMS and paste it on Home or Expenses; the amount, merchant and date are filled in for you.</div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="btn small" onClick={() => { saveSettings({ ignoredSms: [] }); notify('Skipped SMS will show again'); }}>Show skipped SMS again</button>
        </div>
        {Object.keys(s.learned || {}).length > 0 && (
          <div className="xs muted" style={{ marginTop: 10 }}>
            Learned {Object.keys(s.learned).length} merchant rule(s). <button className="btn ghost xs" onClick={() => saveSettings({ learned: {} })}>Clear</button>
          </div>
        )}
      </div>

      <RemindersCard />

      <AutoBackupCard onRestore={restoreData} />

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>💾 Your data</h3>
        <div className="small muted" style={{ marginBottom: 10 }}>
          Saved only on this {isNative() ? 'phone' : 'browser'}. Nothing is sent anywhere. If the app is uninstalled or its data is cleared, it is gone — so take a backup now and then.
          {s.lastBackup ? ` Last backup: ${fmtDate(s.lastBackup, { day: 'numeric', month: 'short', year: 'numeric' })}.` : ' No backup yet.'}
        </div>
        <div className="row wrap">
          <button className="btn small primary" onClick={backup}>⬇ Backup now</button>
          <label className="btn small">⬆ Restore from backup<input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; f && restore(f); }} /></label>
          <button className="btn small" onClick={loadSample}>✨ Load sample data</button>
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="btn small danger" onClick={wipe}>🗑 Erase all data on this device</button>
        </div>
      </div>

      <SecurityCard />

      {catEdit && <CategoryForm cat={catEdit} onClose={() => setCatEdit(null)} />}
    </>
  );
}

function CategoryForm({ cat, onClose }) {
  const { settings, saveSettings, expenses, notify } = useApp();
  const [c, setC] = useState(cat);
  const isNew = !cat.id;
  const save = async () => {
    if (!c.name.trim()) return;
    const rec = { ...c, name: c.name.trim(), id: c.id || 'c_' + uid() };
    const categories = isNew ? [...settings.categories, rec] : settings.categories.map((x) => (x.id === rec.id ? rec : x));
    await saveSettings({ categories }); onClose();
  };
  const del = async () => {
    const used = expenses.filter((e) => e.category === c.id).length;
    if (!(await ask(used ? `${used} transactions use this category. They will show as "Other". Delete?` : 'Delete category?', 'Delete'))) return;
    await saveSettings({ categories: settings.categories.filter((x) => x.id !== c.id) }); notify('Category deleted'); onClose();
  };
  return (
    <Sheet title={isNew ? 'New category' : 'Edit category'} onClose={onClose}>
      <div className="row">
        <label className="field" style={{ width: 80 }}><span>Icon</span><input className="input" style={{ textAlign: 'center', fontSize: 20 }} value={c.icon} maxLength={4} onChange={(e) => setC({ ...c, icon: e.target.value })} /></label>
        <label className="field" style={{ flex: 1 }}><span>Name</span><input className="input" autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
        <label className="field" style={{ width: 70 }}><span>Colour</span><input type="color" className="input" style={{ padding: 4, height: 46 }} value={c.color} onChange={(e) => setC({ ...c, color: e.target.value })} /></label>
      </div>
      <div className="row">
        {!isNew && !['other', 'income', 'emi', 'udhar'].includes(c.id) && <button className="btn danger" onClick={del}>Delete</button>}
        <button className="btn primary" style={{ flex: 1 }} onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

function RemindersCard() {
  const { settings: s, saveSettings, dues, notify } = useApp();
  const [perm, setPerm] = useState('…');
  useEffect(() => { reminderPermission().then(setPerm).catch(() => setPerm('unsupported')); }, []);
  const next = planNotifications(dues, s)[0];
  const allow = async () => {
    const p = await reminderPermission(true).catch(() => 'denied');
    setPerm(p);
    notify(p === 'granted' ? 'Notifications allowed' : 'Notifications blocked — allow them in phone/browser settings');
  };
  const row = (label, hint, key) => (
    <div className="row between" style={{ padding: '6px 0' }}>
      <div><div>{label}</div>{hint && <div className="xs muted">{hint}</div>}</div>
      <Toggle checked={s[key]} onChange={(v) => saveSettings({ [key]: v })} label={label} />
    </div>
  );
  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>🔔 Due-date reminders</h3>
      {row('Reminders on', 'Notification on due date for EMIs and Udhar', 'remindersOn')}
      {s.remindersOn && (
        <>
          {row('EMI due dates', null, 'remindEmi')}
          {row('Udhar to pay & to collect', null, 'remindUdhar')}
          {row('Also remind 1 day before', null, 'remindDayBefore')}
          <div className="row between" style={{ padding: '6px 0' }}>
            <div>Reminder time</div>
            <input id="reminder-time" type="time" className="input" style={{ width: 130 }} value={s.reminderTime} onChange={(e) => saveSettings({ reminderTime: e.target.value || '09:00' })} />
          </div>
          <div className="row between wrap" style={{ marginTop: 6, gap: 8 }}>
            <span className="xs muted">
              {perm === 'granted' ? '✓ Notifications allowed' : perm === 'unsupported' ? 'This browser can\'t show notifications — dues still show on Home' : perm === 'denied' ? 'Notifications blocked in settings' : 'Notifications not allowed yet'}
              {next ? ` · next: ${fmtDate(next.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            {perm !== 'granted' && perm !== 'unsupported' && <button className="btn small primary" onClick={allow}>Allow notifications</button>}
          </div>
          {!isNative() && <div className="xs muted" style={{ marginTop: 6 }}>On laptop, reminders appear when the app is open. The Android app reminds you even when it is closed.</div>}
        </>
      )}
    </div>
  );
}

function SecurityCard() {
  const { user, notify } = useApp();
  const [mode, setMode] = useState(null); // 'set' | null
  const [pin, setPinVal] = useState('');
  const [pin2, setPin2] = useState('');
  const save = async () => {
    if (!/^\d{4}$/.test(pin)) return notify('PIN must be 4 digits');
    if (pin !== pin2) return notify('PINs do not match');
    await setPin(pin); setMode(null); setPinVal(''); setPin2(''); notify('PIN saved');
  };
  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>🔐 App lock</h3>
      <div className="small muted" style={{ marginBottom: 10 }}>{user.hasPin ? 'A 4-digit PIN is asked each time the app is opened.' : 'Add a 4-digit PIN so others using your phone cannot open Kharcha.'}</div>
      {mode === 'set' ? (
        <div className="row wrap">
          <input id="new-pin" className="input otp" style={{ width: 120 }} type="password" inputMode="numeric" maxLength={4} placeholder="New" value={pin} onChange={(e) => setPinVal(e.target.value.replace(/\D/g, ''))} />
          <input id="new-pin2" className="input otp" style={{ width: 120 }} type="password" inputMode="numeric" maxLength={4} placeholder="Again" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
          <button className="btn primary small" onClick={save}>Save PIN</button>
          <button className="btn ghost small" onClick={() => setMode(null)}>Cancel</button>
        </div>
      ) : (
        <div className="row wrap">
          <button className="btn small" onClick={() => setMode('set')}>{user.hasPin ? 'Change PIN' : 'Set PIN'}</button>
          {user.hasPin && <button className="btn small" onClick={async () => { if (await ask('Remove the PIN lock?', 'Remove')) { await setPin(''); notify('PIN removed'); } }}>Remove PIN</button>}
          {user.hasPin && <button className="btn small" onClick={lockNow}>🔒 Lock now</button>}
        </div>
      )}
    </div>
  );
}

function AutoBackupCard({ onRestore }) {
  const { settings, saveSettings, autoBk, backupNow, notify } = useApp();
  const [st, setSt] = useState(null);
  const refresh = () => autoBackupStatus().then(setSt).catch(() => setSt({ supported: false }));
  useEffect(() => { refresh(); }, [autoBk?.status]);

  const pick = async () => {
    try { const n = await chooseBackupFolder(); await refresh(); const r = await backupNow(); notify(r.status === 'saved' ? `Auto-backup on → folder "${n}"` : 'Folder chosen'); }
    catch (e) { if (e?.name !== 'AbortError') notify('Could not use that folder'); }
  };
  const resume = async () => { if (await resumeBackupFolder()) { await refresh(); const r = await backupNow(); notify(r.status === 'saved' ? 'Backed up' : 'Auto-backup resumed'); } };
  const now = async () => { const r = await backupNow(); notify(r.status === 'saved' ? `Saved ${r.file}` : r.status === 'unchanged' ? 'Already up to date for today' : r.status === 'error' ? 'Backup failed: ' + r.error : 'Choose a folder first'); };
  const restoreLatest = async () => {
    try { const { name, data } = await readLatestNativeBackup(); await onRestore(data, name); }
    catch (e) { notify((e?.message || 'Could not read the folder') + ' — use "Restore from backup" and pick the file.'); }
  };

  const when = autoBk?.at ? fmtDate(autoBk.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h3>🗂️ Daily auto-backup</h3>
        {st?.supported && <Toggle checked={settings.autoBackup} onChange={(v) => saveSettings({ autoBackup: v })} label="Daily auto-backup" />}
      </div>
      {!st ? null : !st.supported ? (
        <div className="small muted">This browser cannot save to a folder automatically (works in the Android app and in Chrome/Edge on a laptop). Use <b>Backup now</b> below.</div>
      ) : (
        <>
          <div className="small muted">
            Saves a copy every day you use Kharcha (updated as you add entries). Keeps the last 7 days + 1 per month for a year.
          </div>
          <div className="small" style={{ marginTop: 8 }}>
            📁 {st.where ? <b>{st.where}</b> : <span className="warn">No folder chosen yet</span>}
            {settings.autoBackup && when && autoBk?.status !== 'error' && <span className="muted"> · last saved {when}</span>}
            {autoBk?.status === 'error' && <div className="bad xs" style={{ marginTop: 4 }}>Last attempt failed: {autoBk.error}</div>}
          </div>
          {settings.autoBackup && (
            <div className="row wrap" style={{ marginTop: 10 }}>
              {st.needsFolder && <button className="btn small primary" onClick={pick}>📁 Choose backup folder</button>}
              {st.needsPermission && <button className="btn small primary" onClick={resume}>▶ Continue auto-backup</button>}
              {!st.needsFolder && !isNative() && <button className="btn small" onClick={pick}>Change folder</button>}
              {st.ready && <button className="btn small" onClick={now}>Back up now</button>}
              {isNative() && <button className="btn small" onClick={restoreLatest}>⟲ Restore latest auto-backup</button>}
            </div>
          )}
          {isNative() && <div className="xs muted" style={{ marginTop: 8 }}>This folder stays even if Kharcha is uninstalled. For extra safety, copy it to Google Drive now and then (or use Backup now → Drive).</div>}
        </>
      )}
    </div>
  );
}
