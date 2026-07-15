"use client";
import { useEffect, useState } from "react";
import { thb } from "@/lib/format";
import { INCOME_CATEGORIES } from "@/lib/constants";
import type { RecurringRule } from "@/lib/recurring";
import type { Cat } from "./EditForm";

const field = "w-full rounded-[10px] border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-ink outline-none";

export function RecurringModal({ groupId, cats, onClose, onError }: {
  groupId: string;
  cats: Cat[];
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [rules, setRules] = useState<RecurringRule[] | null>(null);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [f, setF] = useState<{ vendor: string; amount: string; day_of_month: string; category: string; income_category: string }>(
    { vendor: "", amount: "", day_of_month: "1", category: cats[0]?.id || "personal", income_category: INCOME_CATEGORIES[0] }
  );
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/recurring/${groupId}`);
      if (!res.ok) throw new Error();
      setRules(await res.json());
    } catch {
      setRules([]);
      onError("โหลดรายการอัตโนมัติไม่สำเร็จ");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async () => {
    const amount = parseFloat(f.amount);
    if (!amount || (type === "expense" && !f.vendor)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recurring/${groupId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, amount, type }),
      });
      if (!res.ok) throw new Error();
      setF({ ...f, vendor: "", amount: "" });
      await load();
    } catch { onError("เพิ่มไม่สำเร็จ"); }
    setBusy(false);
  };

  const remove = async (id: string) => {
    setRules((r) => r?.filter((x) => x.id !== id) ?? null);
    try {
      const res = await fetch(`/api/recurring/${groupId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error();
    } catch { onError("ลบไม่สำเร็จ"); load(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-[480px] animate-slide-up overflow-y-auto rounded-t-[20px] border border-white/10 bg-surface px-4 pb-8 pt-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-9 rounded-sm bg-white/20" />
        <div className="mb-1 text-base font-bold">รายการอัตโนมัติ</div>
        <p className="mb-4 text-[11px] leading-relaxed text-ink-faint">ค่าเช่า เงินเดือน ค่าสมาชิก — ระบบจะบันทึกให้อัตโนมัติทุกเดือน (วันที่ 1 ของเดือน)</p>

        <div className="mb-4 rounded-card border border-line bg-white/[0.03] p-3">
          <div className="mb-2.5 flex gap-1.5">
            {([["expense", "รายจ่าย"], ["income", "รายรับ"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setType(v)} className={`flex-1 rounded-lg py-2 text-[13px] font-semibold ${type === v ? (v === "income" ? "bg-income/30 text-income" : "bg-accent/30 text-accent-soft") : "bg-white/5 text-ink-faint"}`}>{l}</button>
            ))}
          </div>

          {type === "income" ? (
            <select value={f.income_category} onChange={(e) => setF({ ...f, income_category: e.target.value })} className={`${field} mb-2 bg-surface-raised`}>
              {INCOME_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder="ชื่อรายการ เช่น ค่าเช่า" className={`${field} mb-2`} />
          )}

          <div className="mb-2 flex gap-2">
            <input type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="จำนวน" className={field} />
            <div className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/[0.06] px-2.5">
              <span className="text-[11px] text-ink-faint">วันที่</span>
              <input type="number" min={1} max={28} value={f.day_of_month} onChange={(e) => setF({ ...f, day_of_month: e.target.value })} className="w-10 bg-transparent py-2 text-center text-sm text-ink outline-none" />
            </div>
          </div>

          {type === "expense" && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <button key={c.id} onClick={() => setF({ ...f, category: c.id })} className="rounded-lg border px-2.5 py-1 text-[11px]"
                  style={{ borderColor: f.category === c.id ? c.color : "rgba(255,255,255,0.1)", background: f.category === c.id ? `${c.color}25` : "transparent", color: f.category === c.id ? c.color : "#9ca3af" }}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <button onClick={add} disabled={busy} className="btn-accent w-full rounded-[10px] py-2.5 text-sm disabled:opacity-60">+ เพิ่มรายการอัตโนมัติ</button>
        </div>

        <div className="flex flex-col gap-2">
          {rules === null ? (
            <>{[0, 1].map((i) => <div key={i} className="skeleton h-14" />)}</>
          ) : rules.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-ink-ghost">ยังไม่มีรายการอัตโนมัติ</div>
          ) : rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-card border border-line bg-white/[0.03] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{r.type === "income" ? (r.income_category || r.vendor) : r.vendor}</div>
                <div className="text-[10px] text-ink-faint">ทุกวันที่ {r.day_of_month} · {r.type === "income" ? "รายรับ" : "รายจ่าย"}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`text-sm font-bold tabular-nums ${r.type === "income" ? "text-income" : "text-ink"}`}>{thb(r.amount)}</div>
                <button onClick={() => remove(r.id!)} aria-label="ลบ" className="text-ink-faint">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
