import test from 'node:test';
import assert from 'node:assert/strict';
import { udharStatus, udharTotals } from '../src/lib/udhar.js';

const iso = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };

test('udhar status: partial, overdue, settled', () => {
  const a = udharStatus({ amount: 5000, dueDate: iso(-2), payments: [{ amount: 2000 }] });
  assert.equal(a.outstanding, 3000); assert.equal(a.overdue, true); assert.equal(a.settled, false);
  const b = udharStatus({ amount: 1000, payments: [{ amount: 1000 }] });
  assert.equal(b.settled, true); assert.equal(b.outstanding, 0);
});

test('udhar totals', () => {
  const t = udharTotals([
    { direction: 'given', amount: 5000, payments: [{ amount: 2000 }] },
    { direction: 'taken', amount: 3000, payments: [] },
    { direction: 'given', amount: 100, settled: true },
  ]);
  assert.deepEqual([t.receivable, t.payable, t.net], [3000, 3000, 0]);
});

import { filesToDelete } from '../src/lib/rotation.js';
test('auto-backup rotation keeps 7 daily + 1 per month for 12 months', () => {
  const names = [];
  for (let i = 0; i < 400; i++) { const d = new Date(Date.UTC(2026, 9, 7 - i)); names.push(`kharcha-backup-${d.toISOString().slice(0, 10)}.json`); }
  names.push('notes.txt');
  const del = new Set(filesToDelete(names));
  const kept = names.filter((n) => n.startsWith('kharcha') && !del.has(n));
  assert.ok(!del.has('notes.txt'));
  assert.equal(kept.length, 7 + 11); // 7 newest (same month as newest) + newest of 11 older months
  assert.ok(kept.includes(names[0]));
});
