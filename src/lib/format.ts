// ─────────────────────────────────────────────────────────────
// THB / number / date formatting. Single source of truth.
// ─────────────────────────────────────────────────────────────

const thbFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/** "฿1,234" */
export function thb(n: number): string {
  return thbFormatter.format(Number.isFinite(n) ? n : 0);
}

/** "1,234" — no currency symbol, for compact chart labels / LINE text. */
export function baht(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("th-TH");
}

/** "5 ก.ค." */
export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/** "ก.ค." from "2026-07" */
export function shortMonth(m: string): string {
  return new Date(m + "-01").toLocaleDateString("th-TH", { month: "short" });
}

/** "กรกฎาคม 2569" from "2026-07" */
export function monthLabel(m: string): string {
  return new Date(m + "-01").toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

/** "อา." weekday short label for a Date. */
export function weekdayShort(d: Date): string {
  return d.toLocaleDateString("th-TH", { weekday: "short" });
}
