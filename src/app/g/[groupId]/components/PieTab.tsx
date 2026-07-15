"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { thb } from "@/lib/format";
import type { MonthlySummary } from "@/lib/types";
import type { Cat } from "./EditForm";
import { SummaryRow, SectionTitle, EmptyState } from "./ui";

export function PieTab({ summary, cats }: { summary: MonthlySummary; cats: Cat[] }) {
  const pieData = cats
    .map((c) => ({ ...c, total: summary.byCategory[c.id]?.total || 0 }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const pieTotal = pieData.reduce((s, c) => s + c.total, 0);

  const incomeEntries = Object.entries(summary.byIncomeCategory || {}).sort((a, b) => b[1] - a[1]);
  const personalSubs = Object.entries(summary.byCategory.personal?.bySubCategory || {}).sort((a, b) => b[1] - a[1]);
  const personalTotal = summary.byCategory.personal?.total || 1;

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <SummaryRow income={summary.totalIncome} expense={summary.totalExpense} net={summary.net} />
      </div>

      {pieData.length === 0 ? <EmptyState>ยังไม่มีรายจ่าย</EmptyState> : (
        <>
          <SectionTitle>สัดส่วนรายจ่าย</SectionTitle>
          <div className="relative mx-auto mb-5 h-[200px] w-[200px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="total" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                  {pieData.map((c) => <Cell key={c.id} fill={c.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] text-ink-faint">รายจ่าย</div>
              <div className="text-[13px] font-bold text-accent-soft tabular-nums">{thb(pieTotal)}</div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2">
            {pieData.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-card border px-3.5 py-2.5"
                style={{ background: `${cat.color}12`, borderColor: `${cat.color}30` }}>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background: cat.color }} />
                  <div>
                    <div className="text-[13px] font-semibold">{cat.label}</div>
                    <div className="text-[10px] text-ink-faint">{((cat.total / pieTotal) * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-sm font-bold tabular-nums" style={{ color: cat.color }}>{thb(cat.total)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {incomeEntries.length > 0 && (
        <div className="rounded-card border border-income/15 bg-income/[0.06] p-3.5">
          <div className="mb-2.5 text-xs font-semibold text-income">รายรับแยกตามประเภท</div>
          {incomeEntries.map(([cat, amt]) => (
            <div key={cat} className="flex justify-between border-b border-income/[0.08] py-1.5 last:border-0">
              <span className="text-[13px] text-ink/80">{cat}</span>
              <span className="text-sm font-semibold text-income tabular-nums">+{thb(amt)}</span>
            </div>
          ))}
        </div>
      )}

      {personalSubs.length > 0 && (
        <div className="mt-3 rounded-card border border-accent/15 bg-accent/[0.06] p-3.5">
          <div className="mb-2.5 text-xs font-semibold text-accent-soft">ส่วนตัว — หมวดย่อย</div>
          {personalSubs.map(([sub, amt]) => (
            <div key={sub} className="mb-2">
              <div className="mb-0.5 flex justify-between">
                <span className="text-xs text-ink/80">{sub}</span>
                <span className="text-xs font-semibold text-accent-soft tabular-nums">{thb(amt)}</span>
              </div>
              <div className="h-[3px] rounded-sm bg-white/[0.06]">
                <div className="h-[3px] rounded-sm bg-accent" style={{ width: `${(amt / personalTotal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
