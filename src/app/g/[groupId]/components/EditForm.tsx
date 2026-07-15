"use client";
import { useState } from "react";
import { INCOME_CATEGORIES, PERSONAL_SUB_CATEGORIES } from "@/lib/constants";
import type { Expense } from "@/lib/types";

export interface Cat { id: string; label: string; color: string }

const fieldCls = "w-full rounded-lg border border-white/12 bg-white/[0.07] px-2.5 py-2 text-sm text-ink outline-none";

export function EditForm({ item, cats, onSave, onDelete, onCancel }: {
  item: Expense;
  cats: Cat[];
  onSave: (patch: Partial<Expense>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    vendor: item.vendor,
    amount: String(item.amount),
    category: String(item.category),
    sub_category: item.sub_category || "",
    note: item.note || "",
    date: item.date,
    type: item.type || "expense",
    income_category: item.income_category || "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const isIncome = f.type === "income";

  const fields: [string, keyof typeof f, string][] = [
    ["ร้านค้า/รายการ", "vendor", "text"],
    ["จำนวน", "amount", "number"],
    ["วันที่", "date", "date"],
    ["หมายเหตุ", "note", "text"],
  ];

  return (
    <div className="animate-fade-in border-l-[3px] border-accent bg-accent/[0.08] p-3.5">
      {fields.map(([label, key, type]) => (
        <div key={key} className="mb-2">
          <label className="mb-0.5 block text-[11px] text-ink-muted">{label}</label>
          <input type={type} value={f[key]} onChange={(e) => set(key, e.target.value)} className={fieldCls} />
        </div>
      ))}

      {!isIncome && (
        <div className="mb-2">
          <label className="mb-1.5 block text-[11px] text-ink-muted">หมวด</label>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((cat) => (
              <button key={cat.id} onClick={() => setF((p) => ({ ...p, category: cat.id, sub_category: "" }))}
                className="rounded-[9px] border px-2.5 py-1 text-[11px]"
                style={{
                  borderColor: f.category === cat.id ? cat.color : "rgba(255,255,255,0.1)",
                  background: f.category === cat.id ? `${cat.color}25` : "transparent",
                  color: f.category === cat.id ? cat.color : "#9ca3af",
                }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isIncome && (
        <div className="mb-2.5">
          <label className="mb-1 block text-[11px] text-ink-muted">ประเภทรายรับ</label>
          <select value={f.income_category} onChange={(e) => setF((p) => ({ ...p, income_category: e.target.value, vendor: e.target.value }))}
            className={`${fieldCls} bg-surface-raised`}>
            {INCOME_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {f.category === "personal" && !isIncome && (
        <div className="mb-2.5">
          <label className="mb-0.5 block text-[11px] text-ink-muted">หมวดย่อย</label>
          <select value={f.sub_category} onChange={(e) => set("sub_category", e.target.value)} className={`${fieldCls} bg-surface-raised`}>
            <option value="">-- เลือกหมวดย่อย --</option>
            {PERSONAL_SUB_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-1.5">
        <button onClick={onDelete} className="flex-1 rounded-[9px] border-none bg-expense py-2 text-[13px] font-semibold text-white">ลบ</button>
        <button onClick={() => onSave({ ...f, amount: parseFloat(f.amount) || 0 })} className="btn-accent flex-[2] rounded-[9px] py-2 text-[13px]">บันทึก</button>
        <button onClick={onCancel} className="flex-1 rounded-[9px] border border-white/10 bg-transparent py-2 text-[13px] text-ink-muted">ยกเลิก</button>
      </div>
    </div>
  );
}
