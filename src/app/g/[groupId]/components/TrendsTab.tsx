"use client";
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from "recharts";
import { thb, shortMonth } from "@/lib/format";
import type { TrendPoint } from "@/lib/types";
import type { Cat } from "./EditForm";
import { SectionTitle, EmptyState } from "./ui";

export function TrendsTab({ trend, cats }: { trend: TrendPoint[]; cats: Cat[] }) {
  if (trend.length === 0) return <EmptyState>ไม่มีข้อมูล</EmptyState>;

  const netData = trend.map((t) => ({ label: shortMonth(t.month), net: (t.totalIncome || 0) - (t.totalExpense || 0) }));

  const topCats = cats
    .map((c) => ({ ...c, total: trend.reduce((s, t) => s + (t.byCategory?.[c.id]?.total || 0), 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];

  return (
    <div className="animate-fade-in">
      <SectionTitle>แนวโน้ม 6 เดือนล่าสุด</SectionTitle>

      <div className="mb-3.5 rounded-card border border-line bg-white/[0.02] p-3.5">
        <div className="mb-2 text-xs font-semibold text-ink-muted">กระแสเงินสุทธิ</div>
        <div className="h-[90px] w-full">
          <ResponsiveContainer>
            <LineChart data={netData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fill: "#4b5563", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="net" stroke="#a5b4fc" strokeWidth={2} dot={{ r: 3, fill: "#a5b4fc" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {topCats.map((cat) => {
        const data = trend.map((t) => ({ label: shortMonth(t.month), v: t.byCategory?.[cat.id]?.total || 0 }));
        return (
          <div key={cat.id} className="mb-2.5 rounded-card border p-3.5" style={{ background: `${cat.color}10`, borderColor: `${cat.color}25` }}>
            <div className="mb-2 flex justify-between">
              <div className="text-[13px] font-semibold" style={{ color: cat.color }}>{cat.label}</div>
              <div className="text-[11px] text-ink-faint tabular-nums">รวม: {thb(cat.total)}</div>
            </div>
            <div className="h-[55px] w-full">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: "#4b5563", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Line type="monotone" dataKey="v" stroke={cat.color} strokeWidth={2} dot={{ r: 3, fill: cat.color }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {last && prev && (() => {
        const diff = (last.totalExpense || 0) - (prev.totalExpense || 0);
        const pct = prev.totalExpense > 0 ? (diff / prev.totalExpense * 100).toFixed(1) : "0";
        const up = diff > 0;
        return (
          <div className="rounded-card border border-line bg-white/[0.02] p-3.5">
            <div className="mb-2.5 text-xs font-semibold text-ink-muted">รายจ่าย: เดือนล่าสุด vs เดือนก่อน</div>
            <div className="flex items-center justify-between">
              <div><div className="text-xl font-extrabold tabular-nums">{thb(last.totalExpense || 0)}</div><div className="text-[11px] text-ink-faint">{shortMonth(last.month)}</div></div>
              <div className="text-center">
                <div className={`text-lg ${up ? "text-expense" : "text-income"}`}>{up ? "↑" : "↓"}</div>
                <div className={`text-xs font-semibold ${up ? "text-expense" : "text-income"}`}>{up ? "+" : ""}{pct}%</div>
              </div>
              <div className="text-right"><div className="text-xl font-extrabold text-ink-faint tabular-nums">{thb(prev.totalExpense || 0)}</div><div className="text-[11px] text-ink-faint">{shortMonth(prev.month)}</div></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
