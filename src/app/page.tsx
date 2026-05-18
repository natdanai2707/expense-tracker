"use client";
import { useState, useEffect, useCallback } from "react";

const CATS = [
  { id: "personal",    label: "ส่วนตัว",          emoji: "👤", color: "#6366f1" },
  { id: "with_layers", label: "WITH LAYERS",       emoji: "🖊️", color: "#f59e0b" },
  { id: "met",         label: "MET Furniture",     emoji: "🪑", color: "#10b981" },
  { id: "steel",       label: "เหล็กใต้ / S-2000", emoji: "⚙️", color: "#ef4444" },
  { id: "other",       label: "อื่นๆ",             emoji: "📦", color: "#8b5cf6" },
];

const thb = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
const getCat = (id: string) => CATS.find(c => c.id === id) || CATS[4];

export default function Page() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor: "", amount: "", category: "personal", note: "", date: new Date().toISOString().split("T")[0] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s] = await Promise.all([
        fetch(`/api/expenses?month=${month}`).then(r => r.json()),
        fetch(`/api/expenses?type=summary&month=${month}`).then(r => r.json()),
      ]);
      setExpenses(Array.isArray(e) ? e : []);
      setSummary(s);
    } catch {}
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? expenses : expenses.filter((e: any) => e.category === filter);

  const save = async () => {
    if (!form.vendor || !form.amount) return;
    setSaving(true);
    await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false); setShowAdd(false);
    setForm({ vendor: "", amount: "", category: "personal", note: "", date: new Date().toISOString().split("T")[0] });
    load();
  };

  const shiftMonth = (n: number) => {
    const d = new Date(month + "-01"); d.setMonth(d.getMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };

  const monthLabel = new Date(month + "-01").toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>💳</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Expense Tracker</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Surf Family & Businesses</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => shiftMonth(-1)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", borderRadius: 7, padding: "4px 10px", fontSize: 14 }}>‹</button>
          <div style={{ padding: "5px 14px", borderRadius: 20, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 12, color: "#a5b4fc", minWidth: 130, textAlign: "center" }}>{monthLabel}</div>
          <button onClick={() => shiftMonth(1)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", borderRadius: 7, padding: "4px 10px", fontSize: 14 }}>›</button>
          <button onClick={() => setShowAdd(true)} style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 13, fontWeight: 600 }}>+ เพิ่มรายการ</button>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>กำลังโหลด...</div>
        ) : <>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
            <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>รวมเดือนนี้</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>{thb(summary?.total || 0)}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{summary?.count || 0} รายการ</div>
            </div>
            {CATS.map(cat => {
              const d = summary?.byCategory?.[cat.id];
              return (
                <div key={cat.id} onClick={() => setFilter(filter === cat.id ? "all" : cat.id)}
                  style={{ background: `linear-gradient(135deg,${cat.color}18,${cat.color}08)`, border: `1px solid ${filter === cat.id ? cat.color : cat.color + "28"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", outline: filter === cat.id ? `2px solid ${cat.color}50` : "none", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{cat.label}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: cat.color }}>{thb(d?.total || 0)}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{d?.count || 0} รายการ</div>
                </div>
              );
            })}
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {[{ id: "all", label: "ทั้งหมด", emoji: "📋", color: "#6366f1" }, ...CATS].map(c => (
              <button key={c.id} onClick={() => setFilter(c.id)}
                style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 500, transition: "all 0.15s", background: filter === c.id ? `${c.color}25` : "transparent", borderColor: filter === c.id ? c.color : "rgba(255,255,255,0.1)", color: filter === c.id ? c.color : "#9ca3af" }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "95px 1fr 120px 155px 75px", padding: "11px 18px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              <span>วันที่</span><span>ร้านค้า</span><span style={{ textAlign: "right" }}>จำนวน</span><span style={{ textAlign: "center" }}>หมวด</span><span style={{ textAlign: "center" }}>โดย</span>
            </div>
            {filtered.length === 0
              ? <div style={{ padding: "44px", textAlign: "center", color: "#4b5563", fontSize: 14 }}>ไม่มีรายการ</div>
              : filtered.map((item: any, i: number) => {
                const cat = getCat(item.category);
                return (
                  <div key={item.id}
                    style={{ display: "grid", gridTemplateColumns: "95px 1fr 120px 155px 75px", padding: "13px 18px", borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "center", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(item.date)}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.vendor}</div>
                      {item.note && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{item.note}</div>}
                    </div>
                    <span style={{ textAlign: "right", fontSize: 14, fontWeight: 600 }}>{thb(item.amount)}</span>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span style={{ padding: "3px 9px", borderRadius: 10, background: `${cat.color}20`, color: cat.color, fontSize: 11, fontWeight: 500, border: `1px solid ${cat.color}30` }}>{cat.emoji} {cat.label}</span>
                    </div>
                    <span style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>{item.added_by}</span>
                  </div>
                );
              })}
          </div>

          {/* LINE guide */}
          <div style={{ marginTop: 20, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#67e8f9", marginBottom: 10 }}>📱 บันทึกผ่าน LINE Group</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { icon: "📸", t: "ถ่ายรูปใบเสร็จ", d: "ส่งรูปใน group → Bot อ่าน OCR อัตโนมัติ" },
                { icon: "✍️", t: "พิมพ์รายการ", d: '"ค่าน้ำมัน 450 ส่วนตัว" หรือ "Kerry 1200 with_layers"' },
                { icon: "📊", t: "ดูสรุป", d: "พิมพ์ /report หรือ /link เพื่อเปิด Dashboard" },
              ].map(item => (
                <div key={item.t} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{item.t}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{item.d}</div>
                </div>
              ))}
            </div>
          </div>
        </>}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)" }}
          onClick={() => setShowAdd(false)}>
          <div style={{ background: "#13131f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 26, width: 410 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>เพิ่มรายการใหม่</div>
            {[
              { label: "ร้านค้า *", key: "vendor", type: "text", ph: "ชื่อร้าน..." },
              { label: "จำนวนเงิน (THB) *", key: "amount", type: "number", ph: "0" },
              { label: "วันที่", key: "date", type: "date", ph: "" },
              { label: "หมายเหตุ", key: "note", type: "text", ph: "รายละเอียด..." },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: "100%", padding: "9px 13px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8f0", fontSize: 14, outline: "none" }} />
              </div>
            ))}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 7 }}>หมวดหมู่</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CATS.map(cat => (
                  <button key={cat.id} onClick={() => setForm({ ...form, category: cat.id })}
                    style={{ padding: "5px 11px", borderRadius: 10, border: "1px solid", fontSize: 11, background: form.category === cat.id ? `${cat.color}25` : "transparent", borderColor: form.category === cat.id ? cat.color : "rgba(255,255,255,0.1)", color: form.category === cat.id ? cat.color : "#9ca3af" }}>
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 10, border: "none", background: saving ? "#4b5563" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 600 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
