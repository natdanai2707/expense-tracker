"use client";
import { useState, useEffect, useCallback } from "react";

const CATS = [
  { id: "personal",    label: "ส่วนตัว",      color: "#6366f1" },
  { id: "with_layers", label: "WITH LAYERS",   color: "#f59e0b" },
  { id: "met",         label: "MET Furniture", color: "#10b981" },
  { id: "steel_s2000", label: "S-2000",        color: "#ef4444" },
  { id: "south_steel", label: "เหล็กใต้",      color: "#f97316" },
  { id: "other",       label: "อื่นๆ",         color: "#8b5cf6" },
];

const PERSONAL_SUBS = ["ค่าอาหาร","อาหารนอกบ้าน/คาเฟ่","ค่าที่พัก/สาธารณูปโภค","ค่าเดินทาง","ค่ารักษาพยาบาล","ช้อปปิ้ง","สันทนาการ","ท่องเที่ยว","ของขวัญ","การออม/ลงทุน","อื่นๆ"];

const thb = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const getCat = (id: string) => CATS.find(c => c.id === id) || CATS[5];

export default function Page() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [form, setForm] = useState({ vendor: "", amount: "", category: "personal", sub_category: "", note: "", date: new Date().toISOString().split("T")[0] });

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
  const shiftMonth = (n: number) => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + n); setMonth(d.toISOString().slice(0, 7)); };

  const save = async () => {
    if (!form.vendor || !form.amount) return;
    setSaving(true);
    await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false); setShowAdd(false);
    setForm({ vendor: "", amount: "", category: "personal", sub_category: "", note: "", date: new Date().toISOString().split("T")[0] });
    load();
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({ vendor: item.vendor, amount: item.amount, category: item.category, sub_category: item.sub_category || "", note: item.note || "", date: item.date });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch("/api/expenses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...editForm }) });
    setEditingId(null);
    load();
  };

  const monthLabel = new Date(month + "-01").toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0", fontFamily: "'IBM Plex Sans Thai', Sarabun, sans-serif" }}>
      
      {/* Header */}
      <div style={{ padding: "16px 16px 0", position: "sticky", top: 0, zIndex: 20, background: "#0a0a0f" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💳</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Expense Tracker</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Surf Family & Businesses</div>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ padding: "8px 16px", borderRadius: 20, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 13, fontWeight: 600 }}>+ เพิ่ม</button>
        </div>

        {/* Month selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => shiftMonth(-1)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#9ca3af", borderRadius: 8, padding: "6px 12px", fontSize: 16 }}>‹</button>
          <div style={{ flex: 1, textAlign: "center", padding: "7px", borderRadius: 12, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 13, color: "#a5b4fc", fontWeight: 600 }}>{monthLabel}</div>
          <button onClick={() => shiftMonth(1)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#9ca3af", borderRadius: 8, padding: "6px 12px", fontSize: 16 }}>›</button>
        </div>
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#4b5563" }}>กำลังโหลด...</div>
        ) : <>

          {/* Total card */}
          <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>รวมเดือนนี้</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-1px" }}>{thb(summary?.total || 0)}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{summary?.count || 0} รายการ</div>
          </div>

          {/* Category cards - horizontal scroll */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "none" }}>
            {CATS.map(cat => {
              const d = summary?.byCategory?.[cat.id];
              return (
                <div key={cat.id} onClick={() => setFilter(filter === cat.id ? "all" : cat.id)}
                  style={{ minWidth: 120, background: `linear-gradient(135deg,${cat.color}20,${cat.color}08)`, border: `2px solid ${filter === cat.id ? cat.color : cat.color + "30"}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6, whiteSpace: "nowrap" }}>{cat.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: cat.color }}>{thb(d?.total || 0)}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{d?.count || 0} รายการ</div>
                </div>
              );
            })}
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14, scrollbarWidth: "none" }}>
            {[{ id: "all", label: "ทั้งหมด", color: "#6366f1" }, ...CATS].map(c => (
              <button key={c.id} onClick={() => setFilter(c.id)}
                style={{ whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 500, background: filter === c.id ? `${c.color}25` : "transparent", borderColor: filter === c.id ? c.color : "rgba(255,255,255,0.1)", color: filter === c.id ? c.color : "#9ca3af", flexShrink: 0 }}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Expense list as cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#4b5563", fontSize: 14 }}>ไม่มีรายการ</div>
            ) : filtered.map((item: any) => {
              const cat = getCat(item.category);
              const isEditing = editingId === item.id;

              return (
                <div key={item.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                  {!isEditing ? (
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.vendor}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{fmtDate(item.date)}</span>
                            <span style={{ padding: "2px 8px", borderRadius: 8, background: `${cat.color}20`, color: cat.color, fontSize: 11, fontWeight: 500 }}>{cat.label}</span>
                            {item.sub_category && <span style={{ padding: "2px 8px", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 11 }}>{item.sub_category}</span>}
                          </div>
                          {item.note && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{item.note}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{thb(item.amount)}</div>
                          <button onClick={() => startEdit(item)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", borderRadius: 8, padding: "4px 12px", fontSize: 12 }}>แก้ไข</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: "16px", background: "rgba(99,102,241,0.08)", borderLeft: "3px solid #6366f1" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#a5b4fc", marginBottom: 12 }}>แก้ไขรายการ</div>
                      {[
                        { label: "ร้านค้า", key: "vendor", type: "text" },
                        { label: "จำนวน (THB)", key: "amount", type: "number" },
                        { label: "วันที่", key: "date", type: "date" },
                        { label: "หมายเหตุ", key: "note", type: "text" },
                      ].map(f => (
                        <div key={f.key} style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>{f.label}</label>
                          <input type={f.type} value={(editForm as any)[f.key]}
                            onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                        </div>
                      ))}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 6 }}>หมวด</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {CATS.map(cat => (
                            <button key={cat.id} onClick={() => setEditForm({ ...editForm, category: cat.id, sub_category: "" })}
                              style={{ padding: "5px 11px", borderRadius: 10, border: "1px solid", fontSize: 12, background: editForm.category === cat.id ? `${cat.color}25` : "transparent", borderColor: editForm.category === cat.id ? cat.color : "rgba(255,255,255,0.1)", color: editForm.category === cat.id ? cat.color : "#9ca3af" }}>
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {editForm.category === "personal" && (
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>หมวดย่อย</label>
                          <select value={editForm.sub_category} onChange={e => setEditForm({ ...editForm, sub_category: e.target.value })}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0", fontSize: 14, outline: "none" }}>
                            <option value="">-- เลือกหมวดย่อย --</option>
                            {PERSONAL_SUBS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={saveEdit} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 600 }}>บันทึก</button>
                        <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 14 }}>ยกเลิก</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Personal sub-category breakdown */}
          {filter === "personal" && summary?.byCategory?.personal?.bySubCategory && Object.keys(summary.byCategory.personal.bySubCategory).length > 0 && (
            <div style={{ marginTop: 16, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#a5b4fc", marginBottom: 12 }}>ส่วนตัว — แยกหมวดย่อย</div>
              {Object.entries(summary.byCategory.personal.bySubCategory)
                .sort((a: any, b: any) => b[1] - a[1])
                .map(([sub, amt]: any) => (
                  <div key={sub} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>{sub}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#a5b4fc" }}>{thb(amt)}</span>
                  </div>
                ))}
            </div>
          )}
        </>}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={() => setShowAdd(false)}>
          <div style={{ background: "#13131f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>เพิ่มรายการใหม่</div>
            {[
              { label: "ร้านค้า *", key: "vendor", type: "text", ph: "ชื่อร้าน..." },
              { label: "จำนวน (THB) *", key: "amount", type: "number", ph: "0" },
              { label: "วันที่", key: "date", type: "date", ph: "" },
              { label: "หมายเหตุ", key: "note", type: "text", ph: "รายละเอียด..." },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6 }}>หมวด</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CATS.map(cat => (
                  <button key={cat.id} onClick={() => setForm({ ...form, category: cat.id, sub_category: "" })}
                    style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid", fontSize: 12, background: form.category === cat.id ? `${cat.color}25` : "transparent", borderColor: form.category === cat.id ? cat.color : "rgba(255,255,255,0.1)", color: form.category === cat.id ? cat.color : "#9ca3af" }}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            {form.category === "personal" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5 }}>หมวดย่อย</label>
                <select value={form.sub_category} onChange={e => setForm({ ...form, sub_category: e.target.value })}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8f0", fontSize: 15, outline: "none" }}>
                  <option value="">-- เลือกหมวดย่อย --</option>
                  {PERSONAL_SUBS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 15 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 12, border: "none", background: saving ? "#4b5563" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 15, fontWeight: 600 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}