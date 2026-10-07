// Udhar = informal money lent to / borrowed from a person.
// direction: 'given' (you lent → receivable) | 'taken' (you borrowed → payable)

export function udharStatus(u) {
  const paid = (u.payments || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const outstanding = Math.max(0, (+u.amount || 0) - paid);
  const settled = !!u.settled || outstanding <= 0.5;
  const due = u.dueDate ? new Date(u.dueDate + 'T00:00:00').getTime() : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysToDue = due != null ? Math.round((due - today.getTime()) / 864e5) : null;
  return { paid, outstanding: settled ? 0 : outstanding, settled, due, daysToDue, overdue: !settled && daysToDue != null && daysToDue < 0 };
}

export function udharTotals(list) {
  let receivable = 0, payable = 0, overdue = 0;
  for (const u of list) {
    const s = udharStatus(u);
    if (s.settled) continue;
    if (u.direction === 'given') receivable += s.outstanding; else payable += s.outstanding;
    if (s.overdue) overdue++;
  }
  return { receivable, payable, net: receivable - payable, overdue };
}

export const dueLabel = (d) => (d == null ? 'No due date' : d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `Due in ${d}d`);
