// Parses Indian bank / card / UPI transaction SMS into structured transactions.
// Pure JS, no dependencies — unit-tested in tests/smsParser.test.js

const AMT = String.raw`(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)`;

const BANKS = {
  HDFC: 'HDFC Bank', SBI: 'SBI', SBIINB: 'SBI', SBIUPI: 'SBI', ICICI: 'ICICI Bank', AXIS: 'Axis Bank',
  KOTAK: 'Kotak Bank', KOTAKB: 'Kotak Bank', PNB: 'PNB', BOB: 'Bank of Baroda', BOI: 'Bank of India',
  CANARA: 'Canara Bank', UNION: 'Union Bank', INDUS: 'IndusInd Bank', YES: 'Yes Bank', IDFC: 'IDFC First',
  AU: 'AU Bank', FEDERAL: 'Federal Bank', RBL: 'RBL Bank', PAYTM: 'Paytm', AMEX: 'Amex', SCB: 'Standard Chartered',
  CITI: 'Citi', HSBC: 'HSBC', JUPITER: 'Jupiter', FI: 'Fi', SLICE: 'Slice', ONECARD: 'OneCard',
};

const IGNORE = [
  /\botp\b/i, /one[\s-]?time[\s-]?password/i, /verification code/i,
  /\bwill be (debited|charged|deducted)/i, /\bis due\b/i, /\bdue (on|date|by)\b/i, /payment reminder/i,
  /\brequest(ed)? (money|for)\b/i, /has requested/i, /\bcollect request/i,
  /pre[\s-]?approved/i, /\bwin\b/i, /\boffer\b/i, /cashback up to/i, /apply now/i, /\bkyc\b/i,
  /\bdeclined\b/i, /\bfailed\b/i, /\bunsuccessful\b/i,
];

const DEBIT = /\b(debited|debit(?:ed)? for|spent|paid|sent|withdrawn|withdrawal|purchase|deducted|charged|txn of|transaction of|payment of|dr\b)/i;
const CREDIT = /\b(credited|received|deposited|refund(?:ed)?|reversed|cr\b)/i;

export function bankFromSender(sender = '') {
  const code = String(sender).toUpperCase().replace(/^[A-Z]{2}-/, '').replace(/[^A-Z]/g, '');
  for (const k of Object.keys(BANKS).sort((a, b) => b.length - a.length)) {
    if (code.includes(k)) return BANKS[k];
  }
  return null;
}

function firstIndex(re, s) {
  const m = re.exec(s);
  return m ? m.index : -1;
}

function cleanMerchant(m) {
  if (!m) return null;
  let s = m.trim();
  if (s.includes('@')) s = s.split('@')[0]; // VPA swiggy@icici -> swiggy
  s = s.replace(/^(vpa|upi|mr\.?|ms\.?|m\/s\.?)\s+/i, '')
    .replace(/[._-]?\d{4,}$/g, '')
    .replace(/[^\w &'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || /^(your|a\/?c|account|ac|xx+\d*|\d+)$/i.test(s) || s.length < 2) return null;
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(' ')
    .slice(0, 40);
}

function extractMerchant(body, type) {
  const pats =
    type === 'debit'
      ? [
          /\bto\s+vpa\s+([\w.\-@]+)/i,
          /\bvpa\s+([\w.\-]+@[\w.\-]+)/i,
          /;\s*([A-Za-z0-9 &.'-]{2,40}?)\s+credited/i,
          /\b(?:at|@)\s+([A-Za-z0-9 &*.'_-]{2,40}?)(?=\s+(?:on|via|using|ref|txn|for|avl|\d{1,2}[-/])|[.,]|$)/i,
          /\btowards\s+([A-Za-z0-9 &.'_-]{2,40}?)(?=\s+(?:on|ref|upi|for)|[.,]|$)/i,
          /\bto\s+([A-Za-z0-9 &.'@_-]{2,40}?)(?=\s+(?:on|ref|upi|via|avl|for|\(|\d{1,2}[-/])|[.,(]|$)/i,
          /\binfo[:\s]+([A-Za-z0-9 &.'*/_-]{2,40})/i,
        ]
      : [
          /\bfrom\s+vpa\s+([\w.\-@]+)/i,
          /\bby\s+(?:neft|imps|rtgs|upi)?\s*(?:from\s+)?([A-Za-z0-9 &.'_-]{2,40}?)(?=\s+(?:on|ref|avl|utr)|[.,(]|$)/i,
          /\bfrom\s+([A-Za-z0-9 &.'@_-]{2,40}?)(?=\s+(?:on|ref|upi|via|avl|in|to|into|\(|\d{1,2}[-/])|[.,(]|$)/i,
        ];
  for (const p of pats) {
    const m = body.match(p);
    if (m) {
      const c = cleanMerchant(m[1]);
      if (c && !/^(a\/?c|acct|account|card|bank|your)\b/i.test(c)) return c;
    }
  }
  return null;
}

function detectMode(b) {
  if (/\bupi\b|\bvpa\b/i.test(b)) return 'UPI';
  if (/\bcredit card\b|\bcard\b/i.test(b)) return 'Card';
  if (/\batm\b|withdrawn|withdrawal/i.test(b)) return 'ATM/Cash';
  if (/\b(neft|imps|rtgs)\b/i.test(b)) return 'Net Banking';
  if (/\bemi\b|\bnach\b|\bach\b|auto[\s-]?debit|e-?mandate/i.test(b)) return 'Auto-debit';
  return 'Bank';
}

export function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'sms_' + (h >>> 0).toString(36);
}

/**
 * @param {{body:string, sender?:string, date?:number}} sms
 * @returns {null | {amount:number,type:'debit'|'credit',merchant:string|null,account:string|null,bank:string|null,mode:string,isEmi:boolean,date:number,raw:string,smsId:string}}
 */
export function parseSms(sms) {
  const raw = String(sms?.body || '').replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 15) return null;
  if (IGNORE.some((re) => re.test(raw))) return null;

  // strip balance / limit clauses so their amount is never picked up
  const body = raw.replace(
    /(avl|avbl|available|avail|total|clr|ledger|closing|curr(?:ent)?|outstanding)\.?\s*(bal(?:ance)?|lmt|limit|amt)[\s:.-]*(?:is\s*)?(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?/gi,
    ' '
  );

  const amtMatch =
    body.match(new RegExp(AMT, 'i')) ||
    body.match(/\b(?:debited|credited|deducted)\s+(?:by|for|with)\s+([\d,]+(?:\.\d{1,2})?)\b/i);
  if (!amtMatch) return null;
  const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0 || amount > 1e8) return null;

  const di = firstIndex(DEBIT, body);
  const ci = firstIndex(CREDIT, body);
  if (di < 0 && ci < 0) return null;
  let type = di >= 0 && (ci < 0 || di < ci) ? 'debit' : 'credit';
  // "credited to a/c ... from your a/c XX1234" style where own account debited
  if (type === 'credit' && /\byour (a\/c|account|acct)[^.]{0,30}\bdebited\b/i.test(body)) type = 'debit';

  const accM = body.match(/(?:a\/c|acct|account|ac|card)(?:\s*no\.?)?[\s:]*(?:ending\s*(?:with|in)?\s*)?[x*#\s.]*(\d{3,6})\b/i);
  const isEmi = /\bemi\b|\bloan\b/i.test(body) && type === 'debit';

  return {
    amount,
    type,
    merchant: extractMerchant(body, type),
    account: accM ? accM[1].slice(-4) : null,
    bank: bankFromSender(sms.sender) || bankFromBody(body),
    mode: detectMode(body),
    isEmi,
    date: Number(sms.date) || dateFromBody(raw) || Date.now(),
    raw,
    smsId: hashId((sms.sender || '') + '|' + (sms.date || '') + '|' + raw),
  };
}

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

/** Transaction date written inside the SMS (pasted SMS have no timestamp). Returns ms at noon local, or null. */
export function dateFromBody(body, now = Date.now()) {
  const b = String(body);
  const mk = (y, m, d) => {
    if (y < 100) y += 2000;
    if (!(m >= 0 && m <= 11 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100)) return null;
    const t = new Date(y, m, d, 12).getTime();
    return new Date(t).getDate() === d ? t : null;
  };
  let m;
  // 2026-10-05
  if ((m = b.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/))) return mk(+m[1], +m[2] - 1, +m[3]);
  // 05-Oct-26, 05Oct26, 05 Oct 2026, 05-OCT
  if ((m = b.match(/\b(\d{1,2})[\s-]?(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s,-]*(\d{4}|\d{2})?(?!\d)/i))) {
    let y = m[3] ? +m[3] : new Date(now).getFullYear();
    let t = mk(y, MON[m[2].toLowerCase()], +m[1]);
    if (t && !m[3] && t > now + 864e5) t = mk(y - 1, MON[m[2].toLowerCase()], +m[1]);
    return t;
  }
  // 05-10-26, 05/10/2026, 05.10.26  (day first, Indian format)
  if ((m = b.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/))) return mk(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function bankFromBody(b) {
  b = b.replace(/\S+@\S+/g, ' '); // ignore UPI handles like swiggy@icici
  const m = b.match(/\b(HDFC|SBI|ICICI|Axis|Kotak|PNB|IndusInd|Yes Bank|IDFC|Federal|Canara|Union Bank|Bank of Baroda|Paytm)\b/i);
  return m ? bankFromSender(m[1].replace(/\s.*/, '')) || m[1] : null;
}

/** Parse many messages (e.g. pasted block or inbox dump). Splits pasted text on blank lines. */
export function parseMany(input) {
  const list = Array.isArray(input)
    ? input
    : String(input || '')
        .split(/\r?\n\s*\r?\n/)
        .flatMap((chunk) => {
          // several SMS pasted on separate lines without a blank line between them
          const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          return lines.length > 1 && lines.filter((l) => parseSms({ body: l })).length >= 2 ? lines : [chunk];
        })
        .map((body) => ({ body }));
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const t = parseSms(s);
    if (t && !seen.has(t.smsId)) {
      seen.add(t.smsId);
      out.push(t);
    }
  }
  return out;
}
