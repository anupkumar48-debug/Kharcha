// Loan / EMI maths (reducing-balance, monthly compounding)

export function calcEmi(principal, annualRate, months) {
  const P = +principal, n = +months, r = +annualRate / 12 / 100;
  if (!P || !n) return 0;
  if (!r) return P / n;
  const f = Math.pow(1 + r, n);
  return (P * r * f) / (f - 1);
}

export function schedule(loan) {
  const P = +loan.principal, n = +loan.tenure, r = +loan.rate / 12 / 100;
  const emi = +loan.emi || calcEmi(P, loan.rate, n);
  const rows = [];
  let bal = P;
  const start = new Date(loan.startDate);
  for (let i = 0; i < n && bal > 0.5; i++) {
    const interest = bal * r;
    let princ = Math.min(emi - interest, bal);
    bal = Math.max(0, bal - princ);
    const due = new Date(start.getFullYear(), start.getMonth() + i, Math.min(+loan.emiDay || start.getDate(), 28));
    rows.push({ no: i + 1, due: due.getTime(), emi: princ + interest, interest, principal: princ, balance: bal });
  }
  return rows;
}

/** Summary using paid EMI count (explicit) */
export function loanStatus(loan, now = Date.now()) {
  const rows = schedule(loan);
  const paid = Math.min(+loan.paidCount || 0, rows.length);
  const outstanding = paid > 0 ? rows[paid - 1].balance : +loan.principal;
  const next = rows[paid] || null;
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const interestPaid = rows.slice(0, paid).reduce((s, r) => s + r.interest, 0);
  const overdue = rows.slice(paid).filter((r) => r.due < now).length;
  return {
    emi: rows[0]?.emi || 0,
    paid,
    total: rows.length,
    remaining: rows.length - paid,
    outstanding,
    next,
    overdue,
    totalInterest,
    interestPaid,
    totalPayable: +loan.principal + totalInterest,
    progress: rows.length ? paid / rows.length : 0,
    endDate: rows[rows.length - 1]?.due,
  };
}
