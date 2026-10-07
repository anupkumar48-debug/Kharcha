// Pure helpers for backup file rotation (unit-tested).
export const NAME_RE = /^kharcha-backup-(\d{4}-\d{2}-\d{2})\.json$/;

/** Which backup files to delete: keep newest `daily` days + newest file of each of the last `monthly` months. Pure; unit-tested. */
export function filesToDelete(names, daily = 7, monthly = 12) {
  const dated = names.map((n) => ({ n, d: (n.match(NAME_RE) || [])[1] })).filter((x) => x.d).sort((a, b) => (a.d < b.d ? 1 : -1));
  const keep = new Set(dated.slice(0, daily).map((x) => x.n));
  const months = new Set();
  for (const x of dated) {
    const m = x.d.slice(0, 7);
    if (!months.has(m) && months.size < monthly) { months.add(m); keep.add(x.n); }
  }
  return dated.filter((x) => !keep.has(x.n)).map((x) => x.n);
}

