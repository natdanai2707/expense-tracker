// ─────────────────────────────────────────────────────────────
// Date helpers. The month range is the *real* calendar range —
// never a hardcoded "-31" (that throws on a `date` column for
// Feb/Apr/Jun/Sep/Nov and silently empties the dashboard).
// All month keys are "YYYY-MM"; all day keys are "YYYY-MM-DD".
// ─────────────────────────────────────────────────────────────

/** Current month key "YYYY-MM" in Asia/Bangkok. */
export function currentMonth(): string {
  return bangkokParts().slice(0, 7);
}

/** Today "YYYY-MM-DD" in Asia/Bangkok. */
export function todayISO(): string {
  return bangkokParts();
}

/** "YYYY-MM-DD" for "now" in Asia/Bangkok, avoiding UTC off-by-one. */
function bangkokParts(): string {
  // en-CA gives ISO-ordered YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** Number of days in the given month key "YYYY-MM". */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  // day 0 of next month === last day of this month
  return new Date(y, m, 0).getDate();
}

/**
 * Inclusive-start / exclusive-end date range for a month, safe for a
 * Postgres `date` column: [YYYY-MM-01, nextMonth-01).
 */
export function monthRange(month: string): { start: string; endExclusive: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const endExclusive = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { start, endExclusive };
}

/** Real last day of the month, "YYYY-MM-DD". */
export function lastDayOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

/** Shift a month key by n months (n may be negative). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The last `count` month keys ending at (and including) `month`, oldest first. */
export function recentMonths(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(month, -(count - 1 - i)));
}

/** All day keys "YYYY-MM-DD" in a month, in order. */
export function daysOfMonth(month: string): string[] {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** 0=Sunday..6=Saturday for the first day of the month (for calendar grids). */
export function firstWeekdayOfMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).getDay();
}
