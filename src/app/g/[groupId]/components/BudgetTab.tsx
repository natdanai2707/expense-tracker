"use client";
import { useState } from "react";
import { thb } from "@/lib/format";
import type { MonthlySummary } from "@/lib/types";
import type { Cat } from "./EditForm";

export function BudgetTab({ summary, cats, budgets, onSave }: {
  summary: MonthlySummary;
  cats: Cat[];
  budgets: Record<string, number>;
  onSave: (budgets: Record<string, number>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>(budgets);
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(budgets); setEditing(true); };
  const save = async () => { setSaving(true); await onSave(draft); setSaving(false); setEditing(false); };

  return (
    <div className="animate-fade-in">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-ink-muted">งบประมาณเดือนนี้</div>
        <button onClick={() => (editing ? setEditing(false) : startEdit())}
          className="rounded-xl border border-white/10 bg-transparent px-3.5 py-1.5 text-xs text-ink-muted">
          {editing ? "ยกเลิก" : "ตั้งงบ"}
        </button>
      </div>

      {editing && (
        <div className="mb-3.5 rounded-card border border-line bg-white/[0.03] p-3.5">
          {cats.map((cat) => (
            <div key={cat.id} className="mb-2.5 flex items-center gap-2.5">
              <div className="flex-1 text-[13px]" style={{ color: cat.color }}>{cat.label}</div>
              <input type="number" inputMode="numeric" placeholder="0" value={draft[cat.id] || ""}
                onChange={(e) => setDraft({ ...draft, [cat.id]: parseFloat(e.target.value) || 0 })}
                className="w-[100px] rounded-lg border border-white/12 bg-white/[0.07] px-2.5 py-1.5 text-right text-[13px] text-ink outline-none" />
            </div>
          ))}
          <button onClick={save} disabled={saving} className="btn-accent w-full rounded-[10px] py-2.5 text-sm disabled:opacity-60">
            {saving ? "กำลังบันทึก..." : "บันทึกงบ"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {cats.map((cat) => {
          const spent = summary.byCategory[cat.id]?.total || 0;
          const budget = budgets[cat.id] || 0;
          const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
          const over = budget > 0 && spent > budget;
          const barColor = over ? "#ef4444" : pct > 75 ? "#f59e0b" : "#10b981";
          return (
            <div key={cat.id} className="rounded-card border border-line bg-white/[0.03] px-4 py-3.5">
              <div className="mb-2 flex justify-between">
                <div className="text-[13px] font-semibold" style={{ color: cat.color }}>{cat.label}</div>
                <div>
                  <span className={`text-sm font-bold tabular-nums ${over ? "text-expense" : "text-ink"}`}>{thb(spent)}</span>
                  {budget > 0 && <span className="text-[11px] text-ink-faint"> / {thb(budget)}</span>}
                </div>
              </div>
              {budget > 0 ? (
                <>
                  <div className="h-1.5 rounded-sm bg-white/[0.06]">
                    <div className="h-1.5 rounded-sm transition-[width] duration-500" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-[10px]" style={{ color: over ? "#ef4444" : "#6b7280" }}>{over ? `เกินงบ ${thb(spent - budget)}` : `คงเหลือ ${thb(budget - spent)}`}</span>
                    <span className="text-[10px] text-ink-faint">{pct.toFixed(0)}%</span>
                  </div>
                </>
              ) : <div className="text-[11px] text-ink-ghost">ยังไม่ได้ตั้งงบ</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
