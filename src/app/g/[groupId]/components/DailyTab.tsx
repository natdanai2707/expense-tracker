"use client";
import { useState } from "react";
import { thb, fmtDate } from "@/lib/format";
import { firstWeekdayOfMonth } from "@/lib/dates";
import type { DayTotal, Expense } from "@/lib/types";
import { SectionTitle, EmptyState } from "./ui";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// Color intensity for a day's spending relative to the busiest day.
function heat(v: number, max: number): { bg: string; fg: string } {
  if (v <= 0) return { bg: "rgba(255,255,255,0.03)", fg: "#4b5563" };
  const t = max > 0 ? v / max : 0;
  // indigo → red ramp by intensity
  const alpha = 0.15 + t * 0.6;
  const color = t > 0.66 ? "239,68,68" : t > 0.33 ? "245,158,11" : "99,102,241";
  return { bg: `rgba(${color},${alpha.toFixed(2)})`, fg: t > 0.4 ? "#fff" : "#e8e8f0" };
}

export function DailyTab({ month, daily, expenses }: { month: string; daily: DayTotal[]; expenses: Expense[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const maxExpense = Math.max(...daily.map((d) => d.expense), 1);
  const lead = firstWeekdayOfMonth(month);
  const totalExpense = daily.reduce((s, d) => s + d.expense, 0);
  const activeDays = daily.filter((d) => d.expense > 0).length;
  const avg = activeDays > 0 ? totalExpense / activeDays : 0;
  const busiest = daily.reduce((a, b) => (b.expense > a.expense ? b : a), daily[0]);

  const dayItems = selected ? expenses.filter((e) => e.date === selected) : [];

  return (
    <div className="animate-fade-in">
      <SectionTitle>รายจ่ายรายวัน</SectionTitle>

      <div className="mb-3.5 grid grid-cols-3 gap-2">
        <MiniStat label="เฉลี่ย/วันที่ใช้" value={thb(avg)} />
        <MiniStat label="วันที่มีจ่าย" value={`${activeDays} วัน`} />
        <MiniStat label="จ่ายมากสุด" value={busiest && busiest.expense > 0 ? thb(busiest.expense) : "-"} />
      </div>

      <div className="rounded-card border border-line bg-white/[0.02] p-3">
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => <div key={w} className="text-center text-[10px] text-ink-faint">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => <div key={`lead-${i}`} />)}
          {daily.map((d) => {
            const { bg, fg } = heat(d.expense, maxExpense);
            const day = Number(d.date.slice(8, 10));
            const isSel = selected === d.date;
            return (
              <button key={d.date} onClick={() => setSelected(isSel ? null : d.date)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] transition-transform active:scale-95 ${isSel ? "ring-2 ring-accent-soft" : ""}`}
                style={{ background: bg, color: fg }}>
                <span className="font-semibold leading-none">{day}</span>
                {d.expense > 0 && <span className="mt-0.5 text-[8px] leading-none opacity-90 tabular-nums">{compact(d.expense)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-ink-faint">
        น้อย
        <span className="h-3 w-3 rounded" style={{ background: "rgba(99,102,241,0.25)" }} />
        <span className="h-3 w-3 rounded" style={{ background: "rgba(245,158,11,0.5)" }} />
        <span className="h-3 w-3 rounded" style={{ background: "rgba(239,68,68,0.75)" }} />
        มาก
      </div>

      {selected && (
        <div className="mt-3.5 animate-fade-in rounded-card border border-line bg-white/[0.03] p-3.5">
          <div className="mb-2 text-[13px] font-semibold text-accent-soft">{fmtDate(selected)}</div>
          {dayItems.length === 0 ? <EmptyState>ไม่มีรายการวันนี้</EmptyState> : (
            <div className="flex flex-col gap-1.5">
              {dayItems.map((it) => (
                <div key={it.id} className="flex justify-between border-b border-line py-1.5 last:border-0">
                  <span className="truncate text-[13px]">{it.vendor}</span>
                  <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${it.type === "income" ? "text-income" : "text-ink"}`}>
                    {it.type === "income" ? "+" : ""}{thb(it.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-white/[0.03] px-3 py-2.5">
      <div className="mb-0.5 text-[10px] text-ink-faint">{label}</div>
      <div className="text-[13px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}
