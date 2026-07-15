"use client";
import { thb } from "@/lib/format";

export function StatCard({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" | "net" }) {
  const styles = {
    income: "bg-income/10 border-income/25 text-income",
    expense: "bg-expense/10 border-expense/25 text-expense",
    net: value >= 0 ? "bg-accent/10 border-accent/25 text-accent-soft" : "bg-expense/10 border-expense/25 text-expense",
  }[tone];
  return (
    <div className={`rounded-card border px-3.5 py-3 ${styles}`}>
      <div className="mb-0.5 text-[10px] text-ink-faint">{label}</div>
      <div className="text-base font-bold tabular-nums">{tone === "income" && value > 0 ? "+" : ""}{thb(value)}</div>
    </div>
  );
}

export function SummaryRow({ income, expense, net }: { income: number; expense: number; net: number }) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      <StatCard label="รายรับ" value={income} tone="income" />
      <StatCard label="รายจ่าย" value={expense} tone="expense" />
      <StatCard label="คงเหลือ" value={net} tone="net" />
    </div>
  );
}

export function MonthNav({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <button onClick={onPrev} aria-label="เดือนก่อนหน้า" className="rounded-lg border-none bg-white/[0.06] px-3 py-1.5 text-base text-ink-muted">‹</button>
      <div className="flex-1 rounded-xl border border-accent/30 bg-accent/15 px-2 py-1.5 text-center text-[13px] font-semibold text-accent-soft">{label}</div>
      <button onClick={onNext} aria-label="เดือนถัดไป" className="rounded-lg border-none bg-white/[0.06] px-3 py-1.5 text-base text-ink-muted">›</button>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-pill border px-3.5 py-1 text-xs transition-colors ${value === v ? "border-accent bg-accent/20 text-accent-soft" : "border-white/10 bg-transparent text-ink-muted"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-ink-ghost">{children}</div>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-[13px] font-semibold text-ink-muted">{children}</div>;
}
