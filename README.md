# Kharcha — private expense, budget, EMI & Udhar tracker (family edition)

For **personal use by friends and family**. Every person's data stays **on their own device** — no login server, no cloud, no Play Store, no running cost.

| Device | How people get it | Data stored in |
|---|---|---|
| Android phone | `Kharcha.apk` link (GitHub Release) or the APK file shared on WhatsApp | The app on that phone |
| Laptop / iPhone | Web link (GitHub Pages) → "Install app" / "Add to Home Screen" | That browser on that device |
| Fully offline (laptop) | `kharcha.html` single file — double-click to open | That browser on that laptop |

## Features
- **Expenses** — add by hand, **auto SMS reader** on Android (reads new bank/UPI/card SMS on app open, after the user allows SMS access; on-device only), or **paste SMS** on laptop/iPhone.
- **Budget** — Monthly budget and/or Category budgets, safe-to-spend per day, 6-month history, ✨ suggest from past spend.
- **EMI/Udhar** — EMI calculator, schedule, balance, Mark paid; Udhar given/taken with part payments.
- **Reminders** — a day before + on due date + while overdue, for EMIs and Udhar (to pay and to collect). Android: works even when the app is closed.
- **Trends**, custom menu & Home cards, custom categories, dark mode, CSV export.
- **Daily auto-backup** — Android: every day the app is used, a backup is written to **Documents/Kharcha** (survives uninstall); laptop (Chrome/Edge): to a folder you pick once. Keeps 7 daily + 12 monthly files. One-tap "Restore latest auto-backup".
- **Privacy** — optional 4-digit PIN lock, manual Backup/Restore (share to Drive/WhatsApp), Erase all data.

## Share it with family — one-time setup (~30 min, ₹0)
You need a free GitHub account and a computer with Java 17+ (for creating the signing key once).

1. **Create a GitHub repo** (Public — no personal data is in the code; GitHub release downloads need a public repo) and upload this folder.
2. **Create the signing key once:** `bash scripts/make-keystore.sh` → add the 4 secrets it prints (repo → Settings → Secrets and variables → Actions). **Keep `kharcha-upload.jks` + password safe forever** — every update must use the same key, otherwise family must uninstall (= lose data) to update.
3. **Build the APK:** repo → Actions → **Build APK** → Run workflow. In ~8 min a Release appears with `Kharcha.apk`.
   Permanent link to always the newest version: `https://github.com/<you>/<repo>/releases/latest/download/Kharcha.apk`
4. **Web version:** repo → Settings → Pages → Source: **GitHub Actions**. The **Web app** workflow publishes:
   - App: `https://<you>.github.io/<repo>/`
   - Install guide (English + Hindi): `https://<you>.github.io/<repo>/install.html` ← **share this link in the family WhatsApp group**
5. **Updates:** change code → run **Build APK** again → family installs the new APK over the old one (data kept).

> Android note: Google plans to require verified developers for sideloaded apps on certified Android phones in India from **2027** (Sept 2026 only in Brazil, Indonesia, Singapore, Thailand). Before then, register a free **limited-distribution** Android developer account (for sharing with up to 20 devices) so the APK keeps installing. Until enforcement nothing extra is needed.

## Run / develop
```bash
npm install
npm run dev            # http://localhost:5173
npm test               # SMS paste parser + EMI + Udhar tests
npm run build:single   # dist-single/kharcha.html (whole app in one offline file)
npm run android:init   # local Android Studio build (optional)
```

## Project structure
```
src/App.jsx              shell, navigation, reminders, settings defaults
src/screens/             Login (name + PIN), Home, Transactions, AddExpense, SmsImport (paste), Budget, Loans (EMI/Udhar), Udhar, Trends, Settings
src/lib/backend.js       on-device storage, profile, PIN lock, erase
src/lib/backup.js        manual backup/restore + CSV via share sheet (Android) or download (web)
src/lib/autobackup.js    daily auto-backup to Documents/Kharcha (Android) or a chosen folder (laptop)
src/lib/smsParser.js     pasted bank SMS → transaction incl. date (unit-tested)
src/lib/reminders.js     EMI/Udhar due-date notifications
public/install.html      family install guide (EN + Hindi)
.github/workflows/       build-apk.yml (signed APK → GitHub Release), web.yml (GitHub Pages)
```
