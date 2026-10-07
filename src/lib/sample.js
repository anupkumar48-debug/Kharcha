import { toInputDate } from './format.js';
// Realistic sample data for trying the app (4 months)
const R = (a, b) => Math.round(a + Math.random() * (b - a));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function makeSampleData() {
  const now = new Date();
  const ex = [];
  let n = 0;
  const add = (date, amount, category, merchant, mode = 'UPI', type = 'debit') =>
    date <= Date.now() && ex.push({ id: 'sample_' + n++, date, amount, category, merchant, mode, type, source: n % 3 ? 'sms' : 'manual', note: '' });

  for (let m = 3; m >= 0; m--) {
    const y = now.getFullYear(), mo = now.getMonth() - m;
    const day = (d, h = 12) => new Date(y, mo, d, h, R(0, 59)).getTime();
    add(day(1, 10), 85000, 'income', 'Salary - Acme Corp', 'Net Banking', 'credit');
    add(day(2), 22000, 'rent', 'Landlord', 'Net Banking');
    add(day(5, 9), 10624, 'emi', 'HDFC Bank', 'Auto-debit');
    add(day(7, 9), 4167, 'emi', 'Bajaj Finserv', 'Auto-debit');
    add(day(R(3, 8)), R(900, 1600), 'bills', pick(['Airtel', 'Jio']), 'UPI');
    add(day(R(10, 15)), R(1800, 3200), 'bills', 'Tata Power', 'UPI');
    add(day(R(1, 5)), 649, 'entertainment', 'Netflix', 'Card');
    add(day(10), 5000, 'investment', 'Groww SIP', 'Auto-debit');
    for (let d = 1; d <= 28; d++) {
      if (Math.random() < 0.55) add(day(d, R(12, 22)), R(150, 650), 'food', pick(['Swiggy', 'Zomato', 'Chaayos', "Domino's"]));
      if (Math.random() < 0.3) add(day(d, R(8, 21)), R(200, 1400), 'groceries', pick(['Blinkit', 'Zepto', 'BigBasket', 'DMart']));
      if (Math.random() < 0.35) add(day(d, R(8, 20)), R(90, 480), 'travel', pick(['Uber', 'Ola', 'Rapido', 'Metro']));
      if (Math.random() < 0.08) add(day(d), R(800, 4500), 'shopping', pick(['Amazon', 'Flipkart', 'Myntra']), 'Card');
      if (Math.random() < 0.06) add(day(d), R(200, 900), 'health', pick(['Tata 1mg', 'Apollo Pharmacy']));
    }
    if (m % 2 === 0) add(day(R(14, 20)), R(1500, 3000), 'travel', 'HPCL Petrol', 'Card');
  }

  const paid = (back, d) => back + (now.getDate() >= d ? 1 : 0);
  const first = (back, d) => { const x = new Date(now.getFullYear(), now.getMonth() - back, d); return toInputDate(x); };
  const loans = [
    { id: 'sample_loan1', name: 'Car loan', type: 'car', lender: 'HDFC Bank', principal: 500000, rate: 10, tenure: 60, startDate: first(14, 5), emiDay: 5, paidCount: paid(14, 5), emi: 0, date: Date.now() },
    { id: 'sample_loan2', name: 'Personal loan', type: 'personal', lender: 'Bajaj Finserv', principal: 45000, rate: 14, tenure: 12, startDate: first(5, 7), emiDay: 7, paidCount: paid(5, 7), emi: 0, date: Date.now() - 1 },
  ];
  const iso = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return toInputDate(x); };
  const udhar = [
    { id: 'sample_u1', person: 'Rohit (college friend)', phone: '', direction: 'given', amount: 5000, date: new Date(Date.now() - 20 * 864e5).getTime(), lentOn: iso(-20), dueDate: iso(1), note: 'For bike repair', payments: [{ id: 'p1', amount: 2000, date: Date.now() - 6 * 864e5 }] },
    { id: 'sample_u2', person: 'Sharma ji (neighbour)', phone: '', direction: 'taken', amount: 3000, date: new Date(Date.now() - 10 * 864e5).getTime(), lentOn: iso(-10), dueDate: iso(5), note: 'Cash for travel', payments: [] },
    { id: 'sample_u3', person: 'Priya', phone: '', direction: 'given', amount: 1200, date: new Date(Date.now() - 35 * 864e5).getTime(), lentOn: iso(-35), dueDate: iso(-3), note: 'Concert tickets', payments: [] },
  ];
  const catBudgets = { food: 6000, groceries: 5000, travel: 3000, shopping: 4000, entertainment: 1000, bills: 4000 };
  return { expenses: ex, loans, udhar, catBudgets };
}
