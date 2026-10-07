import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSms } from '../src/lib/smsParser.js';
import { guessCategory } from '../src/lib/categories.js';
import { calcEmi, loanStatus } from '../src/lib/loan.js';

const cases = [
  ['VM-HDFCBK', 'Rs.450.00 debited from A/c XX1234 on 05-10-26 to VPA swiggy@icici (UPI Ref No 627812345678). Not you? Call 18002586161', { amount: 450, type: 'debit', merchant: 'Swiggy', account: '1234', bank: 'HDFC Bank', mode: 'UPI', cat: 'food' }],
  ['AD-HDFCBK', 'INR 2,500.00 spent on HDFC Bank Card XX4321 at AMAZON PAY INDIA on 2026-10-05:10:22:11. Avl Lmt: INR 1,22,000.00. Not you? Call 18002586161', { amount: 2500, type: 'debit', merchant: 'Amazon Pay India', account: '4321', mode: 'Card', cat: 'shopping' }],
  ['JD-SBIUPI', 'Dear UPI user A/C X5678 debited by 120.0 on date 05Oct26 trf to UBER INDIA Refno 427812345. If not u? call 1800111109. -SBI', { amount: 120, type: 'debit', merchant: 'Uber India', account: '5678', bank: 'SBI', cat: 'travel' }],
  ['BZ-SBIINB', 'Your a/c no. XXXXXXXX5678 is debited for Rs.1200.00 on 05-10-2026 and credited to a/c no. XXXXXXXX9012 (UPI Ref no 427812345678)', { amount: 1200, type: 'debit', account: '5678', bank: 'SBI' }],
  ['AX-ICICIB', 'ICICI Bank Acct XX123 debited for Rs 5,432.00 on 05-Oct-26; ZOMATO LTD credited. UPI:427812345678. Call 18002662 for dispute.', { amount: 5432, type: 'debit', merchant: 'Zomato Ltd', account: '123', bank: 'ICICI Bank', cat: 'food' }],
  ['VK-KOTAKB', 'Rs 15,000.00 credited to your A/c XX7788 on 01-OCT-26 by NEFT from ACME CORP PVT LTD. Avl Bal Rs 45,210.55', { amount: 15000, type: 'credit', account: '7788', cat: 'income' }],
  ['AD-AXISBK', 'EMI of Rs 12,345 for loan a/c XX9876 has been debited from your Axis Bank account XX1111 on 05-10-26.', { amount: 12345, type: 'debit', isEmi: true, cat: 'emi' }],
  ['VM-HDFCBK', 'Your OTP for transaction of Rs 999 is 123456. Do not share.', null],
  ['VM-AIRTEL', 'Get Rs 500 cashback up to on recharge! Offer valid till Sunday.', null],
  ['VM-HDFCBK', 'Rs 5000 will be debited from your account on 10-10-26 towards SIP', null],
  ['VM-ICICIB', 'Sent Rs.250.00 From HDFC Bank A/C *1234 To BLINKIT On 05/10/26 Ref 627812345678 Not You? Call 18002586161', { amount: 250, type: 'debit', merchant: 'Blinkit', cat: 'groceries' }],
  ['VM-SBICRD', 'Rs.3,999.00 spent on your SBI Credit Card ending 4455 at NETFLIX on 05/10/26. Trxn. not done by you? Report at sbicard.com', { amount: 3999, type: 'debit', merchant: 'Netflix', account: '4455', cat: 'entertainment' }],
  ['VM-PAYTMB', 'Received Rs.500 from Rahul Kumar in your Paytm Payments Bank a/c. UPI Ref 1234', { amount: 500, type: 'credit' }],
  ['VM-HDFCBK', 'Rs.10000 withdrawn at ATM HDFC MG ROAD from A/c XX1234 on 05OCT. Avl bal: Rs 20000', { amount: 10000, type: 'debit', mode: 'ATM/Cash' }],
];

for (const [sender, body, exp] of cases) {
  test(body.slice(0, 50), () => {
    const r = parseSms({ sender, body, date: 1759650000000 });
    if (exp === null) {
      // SBI style without Rs prefix: acceptable to skip; others must be skipped
      if (r) assert.ok(!/otp|will be|offer/i.test(body), 'should ignore ' + body);
      return;
    }
    assert.ok(r, 'parsed');
    for (const [k, v] of Object.entries(exp)) {
      if (k === 'cat') assert.equal(guessCategory(r), v, 'category');
      else assert.equal(r[k], v, k);
    }
  });
}

test('EMI maths', () => {
  const emi = calcEmi(500000, 10, 60);
  assert.ok(Math.abs(emi - 10623.52) < 1, 'emi ' + emi);
  const s = loanStatus({ principal: 500000, rate: 10, tenure: 60, startDate: '2026-01-05', emiDay: 5, paidCount: 12 });
  assert.equal(s.remaining, 48);
  assert.ok(s.outstanding < 500000 && s.outstanding > 400000);
});

import { dateFromBody, parseMany } from '../src/lib/smsParser.js';
test('date from pasted SMS body', () => {
  const d = (s) => { const t = dateFromBody(s, new Date(2026, 9, 7).getTime()); return t && new Date(t).toDateString(); };
  assert.equal(d('debited on 05-10-26 to VPA'), new Date(2026, 9, 5).toDateString());
  assert.equal(d('on 2026-10-05:10:22'), new Date(2026, 9, 5).toDateString());
  assert.equal(d('on date 05Oct26 trf'), new Date(2026, 9, 5).toDateString());
  assert.equal(d('on 01-OCT-26 by NEFT'), new Date(2026, 9, 1).toDateString());
  assert.equal(d('withdrawn on 05OCT. Avl'), new Date(2026, 9, 5).toDateString());
  assert.equal(d('On 05/10/26 Ref'), new Date(2026, 9, 5).toDateString());
  assert.equal(d('on 28 Dec'), new Date(2025, 11, 28).toDateString()); // no year, future → last year
  assert.equal(d('no date here'), null);
});
test('paste: several SMS on separate lines', () => {
  const r = parseMany('Rs.450.00 debited from A/c XX1234 on 05-10-26 to VPA swiggy@icici\nINR 2,500.00 spent on HDFC Bank Card XX4321 at AMAZON on 2026-10-04. Avl Lmt: INR 1,000');
  assert.equal(r.length, 2);
  assert.equal(new Date(r[1].date).getDate(), 4);
});
