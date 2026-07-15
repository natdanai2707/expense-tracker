"use client";
import { useState } from "react";
import { INCOME_CATEGORIES, PERSONAL_SUB_CATEGORIES } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import type { Cat } from "./EditForm";

export interface NewEntry {
  vendor: string;
  amount: string;
  category: string;
  sub_category: string;
  note: string;
  date: string;
  type: "income" | "expense";
  income_category: string;
}

const fieldCls = "w-full rounded-[10px] border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-ink outline-none";

export function AddModal({ cats, onClose, onSubmit }: {
  cats: Cat[];
  onClose: () => void;
  onSubmit: (entry: NewEntry) => Promise<void>;
}) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<NewEntry>({
    vendor: "", amount: "", category: cats[0]?.id || "personal", sub_category: "",
    note: "", date: todayISO(), type: "expense", income_category: INCOME_CATEGORIES[0],
  });
  const set = (k: keyof NewEntry, v: string) => setF((p) => ({ ...p, [k]: v }));

  const isIncome = type === "income";
  const invalid = !f.amount || (!isIncome && !f.vendor);

  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    await onSubmit({ ...f, type });
    setSaving(false);
  };

  const expenseFields: [string, keyof NewEntry, string, string][] = [
    ["ร้านค้า *", "vendor", "text", "ชื่อร้าน..."],
    ["จำนวน (THB) *", "amount", "number", "0"],
    ["วันที่", "date", "date", ""],
    ["หมายเหตุ", "note", "text", "รายละเอียด..."],
  ];
  const incomeFields: [string, keyof NewEntry, string, string][] = [
    ["จำนวน (THB) *", "amount", "number", "0"],
    ["วันที่", "date", "date", ""],
    ["หมายเหตุ", "note", "text", "รายละเอียด..."],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80" onClick={onClose}>
      <div className="w-full max-w-[480px] animate-slide-up rounded-t-[20px] border border-white/10 bg-surface px-4 pb-9 pt-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-9 rounded-sm bg-white/20" />

        <div className="mb-4 flex gap-1.5">
          {([["expense", "รายจ่าย"], ["income", "รายรับ"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setType(v)}
              className={`flex-1 rounded-xl border-none py-2.5 text-sm font-semibold ${type === v ? (v === "income" ? "bg-income/30 text-income" : "bg-accent/30 text-accent-soft") : "bg-white/5 text-ink-faint"}`}>
              {l}
            </button>
          ))}
        </div>

        {isIncome && (
          <div className="mb-2.5">
            <label className="mb-1 block text-[11px] text-ink-muted">ประเภทรายรับ</label>
            <select value={f.income_category} onChange={(e) => setF((p) => ({ ...p, income_category: e.target.value, vendor: e.target.value }))} className={`${fieldCls} bg-surface-raised`}>
              {INCOME_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {(isIncome ? incomeFields : expenseFields).map(([label, key, t, ph]) => (
          <div key={key} className="mb-2.5">
            <label className="mb-1 block text-[11px] text-ink-muted">{label}</label>
            <input type={t} placeholder={ph} value={f[key]} onChange={(e) => set(key, e.target.value)} className={fieldCls} />
          </div>
        ))}

        {!isIncome && (
          <div className="mb-2.5">
            <label className="mb-1.5 block text-[11px] text-ink-muted">หมวด</label>
            <div className="flex flex-wrap gap-1.5">
              {cats.map((cat) => (
                <button key={cat.id} onClick={() => setF((p) => ({ ...p, category: cat.id, sub_category: "" }))}
                  className="rounded-[10px] border px-2.5 py-1 text-xs"
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

        {!isIncome && f.category === "personal" && (
          <div className="mb-3">
            <label className="mb-1 block text-[11px] text-ink-muted">หมวดย่อย</label>
            <select value={f.sub_category} onChange={(e) => set("sub_category", e.target.value)} className={`${fieldCls} bg-surface-raised`}>
              <option value="">-- เลือกหมวดย่อย --</option>
              {PERSONAL_SUB_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="mt-1 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-[11px] border border-white/10 bg-transparent py-2.5 text-sm text-ink-muted">ยกเลิก</button>
          <button onClick={submit} disabled={saving || invalid}
            className={`flex-[2] rounded-[11px] border-none py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${isIncome ? "bg-gradient-to-br from-income to-emerald-600" : "bg-gradient-to-br from-accent-from to-accent-to"}`}>
            {saving ? "กำลังบันทึก..." : isIncome ? "บันทึกรายรับ" : "บันทึกรายจ่าย"}
          </button>
        </div>
      </div>
    </div>
  );
}
