import { useCallback, useEffect, useMemo, useState } from 'react';
import { onUser, createStore, migrateOldDemoData, keepDataPersistent } from './lib/backend.js';
import { DEFAULT_CATEGORIES, guessCategory } from './lib/categories.js';
import { setCurrency } from './lib/format.js';
import { isNative } from './lib/native.js';
import { AppCtx } from './components/ui.jsx';
import Login from './screens/Login.jsx';
import Home from './screens/Home.jsx';
import Transactions from './screens/Transactions.jsx';
import Loans from './screens/Loans.jsx';
import Trends from './screens/Trends.jsx';
import Settings from './screens/Settings.jsx';
import Budget from './screens/Budget.jsx';
import { upcomingDues, syncReminders } from './lib/reminders.js';
import { runAutoBackup, readMeta } from './lib/autobackup.js';
import { LocalNotifications } from '@capacitor/local-notifications';
import AddExpense from './screens/AddExpense.jsx';
import SmsImport from './screens/SmsImport.jsx';

export const SCREENS = {
  home: { label: 'Home', icon: '🏠', C: Home },
  txns: { label: 'Expenses', icon: '🧾', C: Transactions },
  budget: { label: 'Budget', icon: '🎯', C: Budget },
  loans: { label: 'EMI/Udhar', icon: '📅', C: Loans },
  trends: { label: 'Trends', icon: '📊', C: Trends },
  settings: { label: 'Customize', icon: '⚙️', C: Settings },
};

export const WIDGETS = {
  summary: 'Month summary', budget: 'Budget (monthly & category)', categories: 'Top categories',
  upcoming: 'Upcoming dues (EMI & Udhar)', recent: 'Recent transactions', sms: 'Paste bank SMS',
};

export const DEFAULT_SETTINGS = {
  name: '',
  currency: 'INR',
  budget: 30000,
  theme: 'auto',
  accent: '#0f766e',
  categories: DEFAULT_CATEGORIES,
  nav: ['home', 'txns', 'budget', 'loans', 'trends', 'settings'],
  hiddenNav: [],
  widgets: ['summary', 'budget', 'sms', 'upcoming', 'categories', 'recent'],
  hiddenWidgets: [],
  learned: {},
  catBudgets: {},
  remindersOn: true,
  remindEmi: true,
  remindUdhar: true,
  remindDayBefore: true,
  reminderTime: '09:00',
  ignoredSms: [],
  lastBackup: 0,
  autoBackup: true,
};

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { migrateOldDemoData(); keepDataPersistent(); return onUser(setUser); }, []);
  if (user === undefined) return <div className="login"><div className="logo">₹</div></div>;
  if (!user || user.locked) return <Login locked={!!user?.locked} />;
  return <Main user={user} />;
}

function Main({ user }) {
  const store = useMemo(() => createStore(), []);
  const [expenses, setExpenses] = useState([]);
  const [loans, setLoans] = useState([]);
  const [udhar, setUdhar] = useState([]);
  const [loanTab, setLoanTab] = useState('loans');
  const [raw, setRaw] = useState(undefined);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null); // {type:'add'|'sms', data}
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState([]); // parsed SMS awaiting review
  const [txFilter, setTxFilter] = useState(null);

  useEffect(() => store.sub('expenses', setExpenses), [store]);
  useEffect(() => store.sub('loans', setLoans), [store]);
  useEffect(() => store.sub('udhar', setUdhar), [store]);
  useEffect(() => store.subSettings((s) => setRaw(s || {})), [store]);

  const settings = useMemo(() => {
    const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
    // keep newly added defaults visible for older users
    for (const k of Object.keys(SCREENS)) if (!s.nav.includes(k)) {
      const at = DEFAULT_SETTINGS.nav.indexOf(k);
      s.nav = [...s.nav.slice(0, at), k, ...s.nav.slice(at)];
    }
    for (const k of Object.keys(WIDGETS)) if (!s.widgets.includes(k)) s.widgets = [...s.widgets, k];
    s.categories = s.categories.map((c) => (c.id === 'emi' && c.name === 'Loan / EMI' ? { ...c, name: 'EMI / Installment', icon: '📅' } : c));
    if (!s.categories.some((c) => c.id === 'udhar')) s.categories = [...s.categories.filter((c) => c.id !== 'other'), DEFAULT_CATEGORIES.find((c) => c.id === 'udhar'), ...s.categories.filter((c) => c.id === 'other')];
    return s;
  }, [raw]);
  const saveSettings = useCallback((p) => store.saveSettings(p), [store]);
  setCurrency(settings.currency);

  // theme + accent
  useEffect(() => {
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.style.setProperty('--accent', settings.accent);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', settings.accent);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [settings.theme, settings.accent]);

  const catMap = useMemo(() => ({
    other: DEFAULT_CATEGORIES.find((c) => c.id === 'other'),
    ...Object.fromEntries(settings.categories.map((c) => [c.id, c])),
  }), [settings.categories]);

  const notify = useCallback((m) => { setToast(m); clearTimeout(window._khT); window._khT = setTimeout(() => setToast(''), 2600); }, []);
  useEffect(() => {
    const full = () => notify('Phone storage is full — data could not be saved. Free some space and take a backup.');
    window.addEventListener('kh-storage-full', full);
    return () => window.removeEventListener('kh-storage-full', full);
  }, [notify]);

  /* ---------- SMS pipeline ---------- */
  const known = useMemo(() => new Set([...expenses.map((e) => e.smsId).filter(Boolean), ...(settings.ignoredSms || [])]), [expenses, settings.ignoredSms]);

  const toTxn = useCallback((p) => ({
    id: p.smsId, smsId: p.smsId, amount: p.amount, type: p.type, merchant: p.merchant, account: p.account, bank: p.bank,
    mode: p.mode, date: p.date, source: 'sms', category: guessCategory(p, settings.learned), note: '',
  }), [settings.learned]);

  const ingest = useCallback(async (parsed) => {
    const fresh = parsed.filter((p) => !known.has(p.smsId)).map(toTxn);
    if (!fresh.length) return 0;
    setPending((cur) => { const ids = new Set(cur.map((c) => c.id)); return [...cur, ...fresh.filter((f) => !ids.has(f.id))]; });
    return fresh.length;
  }, [known, toTxn]);

  // Bank SMS are added by the user pasting them (no SMS permission needed)
  const scanInbox = useCallback(() => setSheet({ type: 'sms' }), []);

  /* ---------- Daily auto-backup to a device folder ---------- */
  const [autoBk, setAutoBk] = useState(() => ({ status: 'idle', ...readMeta() }));
  const backupNow = useCallback(async () => {
    const r = await runAutoBackup({ settings, expenses, loans, udhar });
    setAutoBk((o) => ({ ...o, ...r, ...(r.status === 'saved' ? readMeta() : {}) }));
    return r;
  }, [settings, expenses, loans, udhar]);
  useEffect(() => {
    if (raw === undefined || !settings.autoBackup) return;
    if (!expenses.length && !loans.length && !udhar.length) return;
    const t = setTimeout(() => { backupNow().catch(() => {}); }, 3000);
    return () => clearTimeout(t);
  }, [raw, settings.autoBackup, backupNow, expenses, loans, udhar]);

  /* ---------- Reminders (EMI + Udhar) ---------- */
  const dues = useMemo(() => upcomingDues(loans, udhar), [loans, udhar]);
  const remindSig = JSON.stringify([dues.map((d) => [d.key, d.due, Math.round(d.amount)]), settings.remindersOn, settings.remindEmi, settings.remindUdhar, settings.remindDayBefore, settings.reminderTime]);
  useEffect(() => {
    if (raw === undefined) return;
    const t = setTimeout(() => syncReminders(dues, settings).catch(() => {}), 800);
    const iv = isNative() ? null : setInterval(() => syncReminders(dues, settings).catch(() => {}), 30 * 60 * 1000);
    return () => { clearTimeout(t); iv && clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindSig, raw === undefined]);
  useEffect(() => {
    if (!isNative()) return;
    const h = LocalNotifications.addListener?.('localNotificationActionPerformed', (e) => {
      const key = e?.notification?.extra?.key || '';
      setTab('loans'); setLoanTab(key.startsWith('udhar') ? 'udhar' : 'loans');
    });
    return () => { h?.then?.((x) => x.remove()); };
  }, []);

  const ctx = {
    user, store, expenses, loans, udhar, dues, autoBk, backupNow, settings, saveSettings, catMap, notify, setTab, loanTab, setLoanTab,
    openAdd: (data) => setSheet({ type: 'add', data }),
    openSms: () => setSheet({ type: 'sms' }),
    scanInbox, pending, setPending, ingest, txFilter, setTxFilter,
  };

  const navItems = settings.nav.filter((k) => SCREENS[k] && (!settings.hiddenNav.includes(k) || k === 'settings'));
  const Screen = (SCREENS[tab] || SCREENS.home).C;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <nav className="side">
          <div className="brand">₹ Kharcha</div>
          {navItems.map((k) => (
            <button key={k} className={'navbtn' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
              <span className="ic">{SCREENS[k].icon}</span>{SCREENS[k].label}
            </button>
          ))}
        </nav>
        <main className="main">
          <Screen />
        </main>
      </div>
      <nav className="bottomnav">
        {navItems.map((k) => (
          <button key={k} className={'navbtn' + (tab === k ? ' on' : '')} onClick={() => setTab(k)} aria-label={SCREENS[k].label}>
            <span className="ic">{SCREENS[k].icon}</span>{SCREENS[k].short || SCREENS[k].label}
          </button>
        ))}
      </nav>
      {tab !== 'settings' && <button className="fab" aria-label="Add expense" onClick={() => setSheet({ type: 'add' })}>＋</button>}
      {sheet?.type === 'add' && <AddExpense initial={sheet.data} onClose={() => setSheet(null)} />}
      {sheet?.type === 'sms' && <SmsImport onClose={() => setSheet(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </AppCtx.Provider>
  );
}
