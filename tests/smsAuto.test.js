import test from 'node:test';
import assert from 'node:assert/strict';
import { pickNew, scanSince } from '../src/lib/smsAuto.js';
import { parseMany } from '../src/lib/smsParser.js';

const d = new Date(2026, 9, 5, 14).getTime();
const inbox = [
  { sender: 'VM-HDFCBK', date: d, body: 'Rs.450.00 debited from A/c XX1234 on 05-10-26 to VPA swiggy@icici (UPI Ref No 627812345678).' },
  { sender: 'VM-HDFCBK', date: d + 1000, body: 'Your OTP for login is 123456' },
  { sender: 'AX-ICICIB', date: d + 2000, body: 'INR 2,500.00 spent on ICICI Bank Card XX4321 at AMAZON on 2026-10-05. Avl Lmt: INR 1,22,000.00' },
];

test('reads inbox objects with sender + date, ignores OTP', () => {
  const p = parseMany(inbox);
  assert.equal(p.length, 2);
  assert.equal(p[0].bank, 'HDFC Bank');
  assert.equal(p[0].date, d);
});

test('skips already known ids and same SMS pasted earlier', () => {
  const p = parseMany(inbox);
  const pasted = { amount: 450, type: 'debit', date: new Date(2026, 9, 5, 12).getTime(), account: '1234' };
  const fresh = pickNew(p, [pasted], new Set([p[1].smsId]));
  assert.equal(fresh.length, 0);
  const fresh2 = pickNew(p, [], new Set());
  assert.equal(fresh2.length, 2);
});

test('different account same amount is kept', () => {
  const p = parseMany(inbox.slice(0, 1));
  const other = { amount: 450, type: 'debit', date: d, account: '9999' };
  assert.equal(pickNew(p, [other]).length, 1);
});

test('scanSince', () => {
  assert.equal(scanSince(0, 30, 100 * 864e5), 70 * 864e5);
  assert.equal(scanSince(1_000_000_000), 1_000_000_000 - 600000);
});
