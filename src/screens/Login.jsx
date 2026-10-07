import { useState } from 'react';
import { setupProfile, unlock, eraseEverything } from '../lib/backend.js';
import { ask } from '../lib/ask.js';

/** First run: name + optional PIN. Later: PIN unlock (only if a PIN was set). */
export default function Login({ locked }) {
  return locked ? <Unlock /> : <Welcome />;
}

function Welcome() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');

  const start = async (e) => {
    e.preventDefault();
    if (pin && !/^\d{4}$/.test(pin)) return setErr('PIN must be 4 digits');
    if (pin && pin !== pin2) return setErr('PINs do not match');
    await setupProfile(name, pin);
  };

  return (
    <div className="login">
      <div className="card">
        <div className="logo">₹</div>
        <h1 style={{ textAlign: 'center' }}>Kharcha</h1>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 4 }}>Expenses, budgets, EMIs & Udhar — private, on your phone</p>
        <form onSubmit={start} style={{ marginTop: 20 }}>
          <label className="field"><span>Your name</span>
            <input id="welcome-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anup" autoComplete="given-name" />
          </label>
          <label className="field"><span>4-digit PIN to lock the app (optional)</span>
            <input id="welcome-pin" className="input otp" value={pin} maxLength={4} inputMode="numeric" type="password"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
          </label>
          {pin.length > 0 && (
            <label className="field"><span>Type the PIN again</span>
              <input id="welcome-pin2" className="input otp" value={pin2} maxLength={4} inputMode="numeric" type="password"
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            </label>
          )}
          {err && <p className="bad small">{err}</p>}
          <button className="btn primary block">Start</button>
        </form>
        <div className="small muted" style={{ marginTop: 16, lineHeight: 1.5 }}>
          🔒 Everything you enter stays <b>on this device only</b>. No account, no internet needed, nothing is sent anywhere.
          Use <b>Customize → Backup</b> now and then to keep a copy safe.
        </div>
      </div>
    </div>
  );
}

function Unlock() {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const go = async (v) => {
    try { await unlock(v); } catch { setErr('Wrong PIN, try again'); setPin(''); }
  };
  const forgot = async () => {
    if (await ask('Forgot your PIN? The only way in is to ERASE all Kharcha data on this device (restore later from a backup file). Erase now?', 'Erase data')) eraseEverything();
  };
  return (
    <div className="login">
      <div className="card">
        <div className="logo">₹</div>
        <h1 style={{ textAlign: 'center' }}>Enter PIN</h1>
        <input id="unlock-pin" className="input otp" style={{ marginTop: 18 }} autoFocus value={pin} maxLength={4} inputMode="numeric" type="password"
          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setPin(v); setErr(''); if (v.length === 4) go(v); }} placeholder="••••" aria-label="PIN" />
        {err && <p className="bad small" style={{ textAlign: 'center' }}>{err}</p>}
        <button className="btn ghost small block" style={{ marginTop: 12 }} onClick={forgot}>Forgot PIN?</button>
      </div>
    </div>
  );
}
