"use client";
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from "recharts";
import { thb, shortMonth, monthLabel } from "@/lib/format";
import type { TrendPoint } from "@/lib/types";
import { SectionTitle, EmptyState } from "./ui";

export function BarTab({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return <EmptyState>ไม่มีข้อมูล</EmptyState>;

  const data = trend.map((t) => ({
    month: t.month,
    label: shortMonth(t.month),
    รายรับ: t.totalIncome || 0,
    รายจ่าย: t.totalExpense || 0,
  }));

  return (
    <div className="animate-fade-in">
      <SectionTitle>รายรับ vs รายจ่าย (6 เดือน)</SectionTitle>
      <div className="h-[180px] w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={2}>
            <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Bar dataKey="รายรับ" radius={[3, 3, 0, 0]} fill="#10b981" fillOpacity={0.65} />
            <Bar dataKey="รายจ่าย" radius={[3, 3, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill="#6366f1" />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-4 mt-2 flex justify-center gap-4">
        <Legend color="#10b981" label="รายรับ" />
        <Legend color="#6366f1" label="รายจ่าย" />
      </div>

      <div className="flex flex-col gap-2">
        {[...trend].reverse().map((t) => {
          const net = (t.totalIncome || 0) - (t.totalExpense || 0);
          return (
            <div key={t.month} className="rounded-card border border-line bg-white/[0.03] px-3.5 py-3">
              <div className="mb-1.5 flex justify-between">
                <div className="text-[13px] font-semibold">{monthLabel(t.month)}</div>
                <div className={`text-[13px] font-bold tabular-nums ${net >= 0 ? "text-income" : "text-expense"}`}>{net >= 0 ? "+" : ""}{thb(net)}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-income">รับ {thb(t.totalIncome || 0)}</span>
                <span className="text-[11px] text-expense">จ่าย {thb(t.totalExpense || 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-[11px] text-ink-muted">{label}</span>
    </div>
  );
}
