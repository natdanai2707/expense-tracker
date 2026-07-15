"use client";
import { thb, fmtDate } from "@/lib/format";
import { categoryMeta } from "@/lib/constants";
import type { Expense } from "@/lib/types";
import { EditForm, type Cat } from "./EditForm";
import { EmptyState } from "./ui";

export function ExpenseList({ items, cats, editingId, onEdit, onSaveEdit, onDelete, onCancelEdit }: {
  items: Expense[];
  cats: Cat[];
  editingId: string | null;
  onEdit: (item: Expense) => void;
  onSaveEdit: (id: string, patch: Partial<Expense>) => void;
  onDelete: (id: string) => void;
  onCancelEdit: () => void;
}) {
  if (items.length === 0) return <EmptyState>ยังไม่มีรายการในเดือนนี้</EmptyState>;

  const catOf = (item: Expense): Cat =>
    cats.find((c) => c.id === item.category) || { id: String(item.category), ...categoryMeta(item.category) };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const isIncome = item.type === "income";
        const cat = isIncome ? { id: "income", color: "#10b981", label: item.income_category || "รายรับ" } : catOf(item);
        const editing = editingId === item.id;
        return (
          <div key={item.id} className={`overflow-hidden rounded-card border ${isIncome ? "border-income/15" : "border-line"} bg-white/[0.03]`}>
            {editing ? (
              <EditForm item={item} cats={cats}
                onSave={(patch) => onSaveEdit(item.id!, patch)}
                onDelete={() => onDelete(item.id!)}
                onCancel={onCancelEdit} />
            ) : (
              <div className="flex items-start justify-between gap-2.5 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 truncate text-sm font-semibold">{item.vendor}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-ink-faint">{fmtDate(item.date)}</span>
                    {isIncome && <span className="rounded-md bg-income/15 px-1.5 py-0.5 text-[11px] font-semibold text-income">รายรับ</span>}
                    <span className="rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: `${cat.color}20`, color: cat.color }}>{cat.label}</span>
                    {item.sub_category && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-ink-muted">{item.sub_category}</span>}
                  </div>
                  {item.added_by && <div className="mt-0.5 text-[10px] text-ink-ghost">โดย {item.added_by}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className={`mb-1.5 text-base font-bold tabular-nums ${isIncome ? "text-income" : "text-ink"}`}>{isIncome ? "+" : ""}{thb(item.amount)}</div>
                  <button onClick={() => onEdit(item)} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-ink-muted">แก้ไข</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
