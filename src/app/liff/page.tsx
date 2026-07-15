"use client";
import { useEffect, useState } from "react";
import { CATEGORIES, PERSONAL_SUB_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";

const CATS = Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label }));

export default function LiffPage() {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [form, setForm] = useState<{
    tempId: string; vendor: string; amount: string; date: string;
    category: string; sub_category: string; note: string; type: string; income_category: string;
  }>({
    tempId: "", vendor: "", amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "personal", sub_category: "อื่นๆ", note: "",
    type: "expense", income_category: INCOME_CATEGORIES[0],
  });
  const isIncome = form.type === "income";
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setForm((prev) => ({
      ...prev,
      tempId: params.get("id") || params.get("tempId") || "",
      vendor: params.get("vendor") || "",
      amount: params.get("amount") || "",
      date: params.get("date") || new Date().toISOString().split("T")[0],
      category: params.get("category") || "personal",
      sub_category: params.get("sub_category") || "อื่นๆ",
      note: params.get("note") || "",
      type: params.get("type") || "expense",
      income_category: params.get("income_category") || INCOME_CATEGORIES[0],
    }));
    setGroupId(params.get("group_id") || "");

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) liff.login();
        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
        const ctx = liff.getContext();
        if (ctx?.groupId) setGroupId(ctx.groupId);
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const close = async () => { try { const liff = (await import("@line/liff")).default; liff.closeWindow(); } catch { /* not in LIFF */ } };

  const handleSubmit = async () => {
    if (!form.amount || (!isIncome && !form.vendor)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/liff-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, line_user_id: lineUserId, group_id: groupId || "default" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `บันทึกไม่สำเร็จ (${res.status})`);
      setDone(true);
      setTimeout(close, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-[10px] border border-gray-200 bg-white px-3.5 py-3 text-[15px] text-gray-900 outline-none focus:border-indigo-400";

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );

  if (done) return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50">
      <div className="text-5xl">✅</div>
      <div className="text-lg font-bold text-gray-900">บันทึกแล้ว!</div>
      <div className="text-sm text-gray-500">กำลังปิดหน้าต่าง...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className={`px-5 py-4 text-white ${isIncome ? "bg-emerald-500" : "bg-indigo-500"}`}>
        <div className="text-base font-bold">{isIncome ? "แก้ไขรายรับ" : "แก้ไขรายการ"}</div>
        <div className="mt-0.5 text-xs opacity-80">ตรวจสอบและแก้ไขข้อมูลก่อนบันทึก</div>
      </div>

      <div className="px-5 pb-28 pt-5">
        {isIncome ? (
          <Labeled label="ประเภทรายรับ">
            <select value={form.income_category} onChange={(e) => setForm((p) => ({ ...p, income_category: e.target.value, vendor: e.target.value }))} className={field}>
              {INCOME_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Labeled>
        ) : (
          <Labeled label="ร้านค้า / Vendor *">
            <input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="ชื่อร้าน..." className={field} />
          </Labeled>
        )}

        <Labeled label="จำนวนเงิน (THB) *">
          <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" className={field} />
        </Labeled>
        <Labeled label="วันที่">
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={field} />
        </Labeled>
        <Labeled label="หมายเหตุ">
          <input value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className={field} />
        </Labeled>

        {!isIncome && (
          <Labeled label="หมวดหมู่">
            <div className="flex flex-wrap gap-2">
              {CATS.map((cat) => (
                <button key={cat.id}
                  onClick={() => setForm((p) => ({ ...p, category: cat.id, sub_category: cat.id === "personal" ? "อื่นๆ" : "" }))}
                  className={`rounded-full border-2 bg-white px-3.5 py-2 text-[13px] font-medium ${form.category === cat.id ? "border-indigo-500 text-indigo-600" : "border-gray-200 text-gray-500"}`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </Labeled>
        )}

        {!isIncome && form.category === "personal" && (
          <Labeled label="หมวดย่อย">
            <select value={form.sub_category} onChange={(e) => set("sub_category", e.target.value)} className={field}>
              {PERSONAL_SUB_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Labeled>
        )}
      </div>

      {error && (
        <div className="fixed inset-x-0 bottom-[76px] border-t border-red-200 bg-red-50 px-5 py-2.5 text-center text-[13px] text-red-700">
          ⚠️ {error}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 flex gap-2.5 border-t border-gray-200 bg-white px-5 py-4">
        <button onClick={close} className="flex-1 rounded-xl border border-gray-200 bg-white py-3.5 text-[15px] font-medium text-gray-500">ปิด</button>
        <button onClick={handleSubmit} disabled={saving || !form.amount || (!isIncome && !form.vendor)}
          className={`flex-[2] rounded-xl border-none py-3.5 text-[15px] font-bold text-white disabled:opacity-50 ${isIncome ? "bg-emerald-500" : "bg-indigo-500"}`}>
          {saving ? "กำลังบันทึก..." : "บันทึก →"}
        </button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[13px] font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
