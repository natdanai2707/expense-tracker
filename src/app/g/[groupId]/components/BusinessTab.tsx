"use client";
import { thb } from "@/lib/format";
import { BUSINESSES } from "@/lib/constants";
import type { MonthlySummary } from "@/lib/types";
import { SectionTitle, EmptyState } from "./ui";

// Income − Expense per business for the month. Only shows businesses whose
// categories are enabled for this group.
export function BusinessTab({ summary, enabledCategories }: { summary: MonthlySummary; enabledCategories: string[] }) {
  const rows = BUSINESSES
    .filter((b) => b.expenseCategories.some((c) => enabledCategories.includes(c)))
    .map((b) => {
      const expense = b.expenseCategories.reduce((s, c) => s + (summary.byCategory[c]?.total || 0), 0);
      const income = b.incomeCategories.reduce((s, c) => s + (summary.byIncomeCategory[c] || 0), 0);
      return { ...b, income, expense, profit: income - expense };
    });

  if (rows.length === 0) return <EmptyState>กลุ่มนี้ยังไม่มีหมวดธุรกิจ</EmptyState>;

  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);

  return (
    <div className="animate-fade-in">
      <SectionTitle>กำไร/ขาดทุน รายธุรกิจ (เดือนนี้)</SectionTitle>

      <div className={`mb-3.5 rounded-card border px-4 py-3.5 ${totalProfit >= 0 ? "border-income/25 bg-income/10" : "border-expense/25 bg-expense/10"}`}>
        <div className="text-[11px] text-ink-faint">กำไรสุทธิรวมทุกธุรกิจ</div>
        <div className={`text-xl font-extrabold tabular-nums ${totalProfit >= 0 ? "text-income" : "text-expense"}`}>{totalProfit >= 0 ? "+" : ""}{thb(totalProfit)}</div>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.id} className="rounded-card border border-line bg-white/[0.03] p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                <div className="text-sm font-semibold" style={{ color: r.color }}>{r.label}</div>
              </div>
              <div className={`text-sm font-bold tabular-nums ${r.profit >= 0 ? "text-income" : "text-expense"}`}>{r.profit >= 0 ? "+" : ""}{thb(r.profit)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-income/[0.08] px-3 py-2">
                <div className="text-[10px] text-ink-faint">รายรับ</div>
                <div className="text-[13px] font-semibold text-income tabular-nums">{thb(r.income)}</div>
              </div>
              <div className="rounded-lg bg-expense/[0.08] px-3 py-2">
                <div className="text-[10px] text-ink-faint">รายจ่าย</div>
                <div className="text-[13px] font-semibold text-expense tabular-nums">{thb(r.expense)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-ghost">
        * รายรับจับคู่กับธุรกิจจากประเภทรายรับ (เช่น “รายรับจาก MET”). S-2000 และเหล็กใต้ยังไม่มีหมวดรายรับแยก
      </p>
    </div>
  );
}
