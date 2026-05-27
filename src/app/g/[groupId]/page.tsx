"use client";
import { useState, useEffect, useCallback } from "react";
import { use } from "react";

const ALL_CATS: Record<string, { label: string; color: string }> = {
  personal:    { label: "ส่วนตัว",      color: "#6366f1" },
  with_layers: { label: "WITH LAYERS",   color: "#f59e0b" },
  met:         { label: "MET Furniture", color: "#10b981" },
  steel_s2000: { label: "S-2000",        color: "#ef4444" },
  south_steel: { label: "เหล็กใต้",      color: "#f97316" },
  other:       { label: "อื่นๆ",         color: "#8b5cf6" },
};

const PERSONAL_SUBS = ["ค่าอาหาร","อาหารนอกบ้าน/คาเฟ่","ค่าที่พัก/สาธารณูปโภค","ค่าเดินทาง","ค่ารักษาพยาบาล","ช้อปปิ้ง","สันทนาการ","ท่องเที่ยว","ของขวัญ","การออม/ลงทุน","อื่นๆ"];
const INCOME_CATS = ["เงินเดือน","รายรับจาก MET","รายรับจาก With Layers","เงินปันผล","ค่าเช่า","เงินคืนบัตรเครดิต","รายรับจากอื่นๆ"];
const TABS = ["รายการ","Pie","Bar","Budget","Trends"];

const thb = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const shortMonth = (m: string) => new Date(m + "-01").toLocaleDateString("th-TH", { month: "short" });

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [cats, setCats] = useState<{ id: string; label: string; color: string }[]>([]);
  const [groupName, setGroupName] = useState("กลุ่มของฉัน");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all"|"income"|"expense">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [editBudget, setEditBudget] = useState(false);
  const [entryType, setEntryType] = useState<"expense"|"income">("expense");
  const [form, setForm] = useState({ vendor: "", amount: "", category: "personal", sub_category: "", note: "", date: new Date().toISOString().split("T")[0], income_category: "เงินเดือน" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s, t, cfg] = await Promise.all([
        fetch(`/api/expenses?month=${month}&group_id=${groupId}`).then(r => r.json()),
        fetch(`/api/expenses?type=summary&month=${month}&group_id=${groupId}`).then(r => r.json()),
        fetch(`/api/expenses?type=monthly_trend&months=6&group_id=${groupId}`).then(r => r.json()),
        fetch(`/api/group-config/${groupId}`).then(r => r.json()),
      ]);
      setExpenses(Array.isArray(e) ? e : []);
      setSummary(s);
      setTrend(Array.isArray(t) ? t : []);
      if (cfg.cats) { setCats(cfg.cats); setGroupName(cfg.name || "กลุ่มของฉัน"); }
      if (cfg.budgets) setBudgets(cfg.budgets);
      if (cfg.cats?.[0]) setForm(f => ({ ...f, category: cfg.cats[0].id }));
    } catch {}
    setLoading(false);
  }, [month, groupId]);

  useEffect(() => { load(); }, [load]);

  const allFiltered = expenses.filter(e => {
    if (typeFilter === "income") return e.type === "income";
    if (typeFilter === "expense") return e.type !== "income";
    return true;
  });
  const filtered = filter === "all" ? allFiltered : allFiltered.filter((e: any) => e.category === filter);

  const shiftMonth = (n: number) => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + n); setMonth(d.toISOString().slice(0, 7)); };
  const getCat = (id: string) => cats.find(c => c.id === id) || ALL_CATS[id] || { label: id, color: "#8b5cf6" };

  const save = async () => {
    if (!form.amount) return;
    if (entryType === "expense" && !form.vendor) return;
    setSaving(true);
    const payload = entryType === "income"
      ? { vendor: form.income_category, amount: form.amount, category: "other", sub_category: "", note: form.note, date: form.date, group_id: groupId, type: "income", income_category: form.income_category }
      : { ...form, group_id: groupId, type: "expense", income_category: "" };
    await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false); setShowAdd(false);
    setForm(f => ({ ...f, vendor: "", amount: "", sub_category: "", note: "", date: new Date().toISOString().split("T")[0] }));
    load();
  };

  const startEdit = (item: any) => { setEditingId(item.id); setEditForm({ vendor: item.vendor, amount: item.amount, category: item.category, sub_category: item.sub_category || "", note: item.note || "", date: item.date, type: item.type || "expense", income_category: item.income_category || "" }); };
  const saveEdit = async () => {
    if (!editingId) return;
    await fetch("/api/expenses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...editForm }) });
    setEditingId(null); load();
  };
  const deleteItem = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return;
    await fetch("/api/expenses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setEditingId(null); load();
  };
  const saveBudgets = async () => {
    await fetch(`/api/group-config/${groupId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budgets }) });
    setEditBudget(false);
  };

  const monthLabel = new Date(month + "-01").toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const pieData = cats.map(cat => ({ ...cat, total: summary?.byCategory?.[cat.id]?.total || 0 })).filter(c => c.total > 0);
  const pieTotal = pieData.reduce((s, c) => s + c.total, 0);
  const barMax = Math.max(...trend.map(t => Math.max(t.totalExpense || 0, t.totalIncome || 0)), 1);
  const catTotals = cats.map(cat => ({ ...cat, total: trend.reduce((s, t) => s + (t.byCategory?.[cat.id]?.total || 0), 0) })).sort((a, b) => b.total - a.total).slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0", fontFamily: "'IBM Plex Sans Thai', Sarabun, sans-serif" }}>
      <div style={{ padding: "16px 16px 0", position: "sticky", top: 0, zIndex: 20, background: "#0a0a0f" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💳</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{groupName}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Expense Tracker</div>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ padding: "8px 16px", borderRadius: 20, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 13, fontWeight: 600 }}>+ เพิ่ม</button>
        </div>
        {[0,1,3].includes(tab) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <button onClick={() => shiftMonth(-1)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#9ca3af", borderRadius: 8, padding: "6px 12px", fontSize: 16 }}>‹</button>
            <div style={{ flex: 1, textAlign: "center", padding: "7px", borderRadius: 12, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 13, color: "#a5b4fc", fontWeight: 600 }}>{monthLabel}</div>
            <button onClick={() => shiftMonth(1)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#9ca3af", borderRadius: 8, padding: "6px 12px", fontSize: 16 }}>›</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: "10px 10px 0 0", border: "none", fontSize: 13, fontWeight: tab === i ? 700 : 400, background: tab === i ? "rgba(99,102,241,0.2)" : "transparent", color: tab === i ? "#a5b4fc" : "#6b7280", borderBottom: tab === i ? "2px solid #6366f1" : "2px solid transparent" }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {loading ? <div style={{ textAlign: "center", padding: 60, color: "#4b5563" }}>กำลังโหลด...</div> : <>

          {/* ── Tab 0: รายการ ── */}
          {tab === 0 && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>รายรับ</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{thb(summary?.totalIncome || 0)}</div>
              </div>
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>รายจ่าย</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>{thb(summary?.totalExpense || 0)}</div>
              </div>
              <div style={{ background: (summary?.net || 0) >= 0 ? "rgba(99,102,241,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${(summary?.net || 0) >= 0 ? "rgba(99,102,241,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>คงเหลือ</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: (summary?.net || 0) >= 0 ? "#a5b4fc" : "#ef4444" }}>{thb(summary?.net || 0)}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[["all","ทั้งหมด"],["income","รายรับ"],["expense","รายจ่าย"]].map(([v,l]) => (
                <button key={v} onClick={() => setTypeFilter(v as any)}
                  style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, background: typeFilter===v ? "rgba(99,102,241,0.2)" : "transparent", borderColor: typeFilter===v ? "#6366f1" : "rgba(255,255,255,0.1)", color: typeFilter===v ? "#a5b4fc" : "#9ca3af" }}>
                  {l}
                </button>
              ))}
            </div>

            {typeFilter !== "income" && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 10, scrollbarWidth: "none" }}>
                {cats.map(cat => {
                  const d = summary?.byCategory?.[cat.id];
                  return (
                    <div key={cat.id} onClick={() => setFilter(filter === cat.id ? "all" : cat.id)}
                      style={{ minWidth: 110, background: `${cat.color}15`, border: `2px solid ${filter === cat.id ? cat.color : cat.color + "30"}`, borderRadius: 12, padding: "10px 12px", cursor: "pointer", flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{cat.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: cat.color }}>{thb(d?.total || 0)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.length === 0
                ? <div style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>ไม่มีรายการ</div>
                : filtered.map((item: any) => {
                  const isIncome = item.type === "income";
                  const cat = isIncome ? { color: "#10b981", label: item.income_category || "รายรับ" } : getCat(item.category);
                  const isEditing = editingId === item.id;
                  return (
                    <div key={item.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isIncome ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.07)"}`, borderRadius: 14, overflow: "hidden" }}>
                      {!isEditing ? (
                        <div style={{ padding: "13px 15px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.vendor}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, color: "#6b7280" }}>{fmtDate(item.date)}</span>
                              {isIncome && <span style={{ padding: "2px 7px", borderRadius: 7, background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: 11, fontWeight: 600 }}>รายรับ</span>}
                              <span style={{ padding: "2px 7px", borderRadius: 7, background: `${cat.color}20`, color: cat.color, fontSize: 11 }}>{cat.label}</span>
                              {item.sub_category && <span style={{ padding: "2px 7px", borderRadius: 7, background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 11 }}>{item.sub_category}</span>}
                            </div>
                            {item.added_by && <div style={{ fontSize: 10, color: "#374151", marginTop: 2 }}>โดย {item.added_by}</div>}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5, color: isIncome ? "#10b981" : "#e8e8f0" }}>{isIncome ? "+" : ""}{thb(item.amount)}</div>
                            <button onClick={() => startEdit(item)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", borderRadius: 7, padding: "3px 10px", fontSize: 11 }}>แก้ไข</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "14px", background: "rgba(99,102,241,0.08)", borderLeft: "3px solid #6366f1" }}>
                          {[{label:"ร้านค้า/รายการ",key:"vendor",type:"text"},{label:"จำนวน",key:"amount",type:"number"},{label:"วันที่",key:"date",type:"date"},{label:"หมายเหตุ",key:"note",type:"text"}].map(f => (
                            <div key={f.key} style={{ marginBottom: 8 }}>
                              <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 3 }}>{f.label}</label>
                              <input type={f.type} value={(editForm as any)[f.key]} onChange={e => setEditForm({...editForm,[f.key]:e.target.value})}
                                style={{ width: "100%", padding: "9px 11px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                          ))}
                          {editForm.type !== "income" && (
                            <div style={{ marginBottom: 8 }}>
                              <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 5 }}>หมวด</label>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                {cats.map(cat => (
                                  <button key={cat.id} onClick={() => setEditForm({...editForm,category:cat.id,sub_category:""})}
                                    style={{ padding: "4px 10px", borderRadius: 9, border: "1px solid", fontSize: 11, background: editForm.category===cat.id?`${cat.color}25`:"transparent", borderColor: editForm.category===cat.id?cat.color:"rgba(255,255,255,0.1)", color: editForm.category===cat.id?cat.color:"#9ca3af" }}>
                                    {cat.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {editForm.type === "income" && (
                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>ประเภทรายรับ</label>
                              <select value={editForm.income_category} onChange={e => setEditForm({...editForm,income_category:e.target.value,vendor:e.target.value})}
                                style={{ width: "100%", padding: "9px 11px", borderRadius: 8, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0", fontSize: 13, outline: "none" }}>
                                {INCOME_CATS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          )}
                          {editForm.category === "personal" && editForm.type !== "income" && (
                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 3 }}>หมวดย่อย</label>
                              <select value={editForm.sub_category} onChange={e => setEditForm({...editForm,sub_category:e.target.value})}
                                style={{ width: "100%", padding: "9px 11px", borderRadius: 8, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0", fontSize: 13, outline: "none" }}>
                                <option value="">-- เลือกหมวดย่อย --</option>
                                {PERSONAL_SUBS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 7 }}>
                            <button onClick={() => deleteItem(editingId!)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: "#ef4444", color: "white", fontSize: 13, fontWeight: 600 }}>ลบ</button>
                            <button onClick={saveEdit} style={{ flex: 2, padding: "9px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 13, fontWeight: 600 }}>บันทึก</button>
                            <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 13 }}>ยกเลิก</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </>}

          {/* ── Tab 1: Pie ── */}
          {tab === 1 && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>รายรับ</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>{thb(summary?.totalIncome || 0)}</div>
              </div>
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>รายจ่าย</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444" }}>{thb(summary?.totalExpense || 0)}</div>
              </div>
              <div style={{ background: (summary?.net||0)>=0?"rgba(99,102,241,0.1)":"rgba(239,68,68,0.1)", border: `1px solid ${(summary?.net||0)>=0?"rgba(99,102,241,0.2)":"rgba(239,68,68,0.2)"}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>สุทธิ</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: (summary?.net||0)>=0?"#a5b4fc":"#ef4444" }}>{thb(summary?.net||0)}</div>
              </div>
            </div>

            {pieData.length > 0 && <>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>สัดส่วนรายจ่าย</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <svg width="200" height="200" viewBox="0 0 200 200">
                  {(() => {
                    let startAngle = -90;
                    return pieData.map((cat) => {
                      const pct = cat.total / pieTotal;
                      const angle = pct * 360;
                      const endAngle = startAngle + angle;
                      const r = 80, cx = 100, cy = 100;
                      const x1 = cx + r * Math.cos(startAngle * Math.PI / 180);
                      const y1 = cy + r * Math.sin(startAngle * Math.PI / 180);
                      const x2 = cx + r * Math.cos(endAngle * Math.PI / 180);
                      const y2 = cy + r * Math.sin(endAngle * Math.PI / 180);
                      const large = angle > 180 ? 1 : 0;
                      const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
                      const el = <path key={cat.id} d={d} fill={cat.color} opacity="0.85" />;
                      startAngle = endAngle;
                      return el;
                    });
                  })()}
                  <circle cx="100" cy="100" r="45" fill="#0a0a0f" />
                  <text x="100" y="96" textAnchor="middle" fill="#e8e8f0" fontSize="10" fontFamily="sans-serif">รายจ่าย</text>
                  <text x="100" y="110" textAnchor="middle" fill="#a5b4fc" fontSize="11" fontWeight="bold" fontFamily="sans-serif">{thb(pieTotal)}</text>
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {pieData.sort((a,b)=>b.total-a.total).map(cat => (
                  <div key={cat.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: `${cat.color}12`, border: `1px solid ${cat.color}30`, borderRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>{(cat.total/pieTotal*100).toFixed(1)}%</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: cat.color }}>{thb(cat.total)}</div>
                  </div>
                ))}
              </div>
            </>}

            {summary?.byIncomeCategory && Object.keys(summary.byIncomeCategory).length > 0 && (
              <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 14, padding: "14px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#10b981", marginBottom: 10 }}>รายรับแยกตามประเภท</div>
                {Object.entries(summary.byIncomeCategory).sort((a:any,b:any)=>b[1]-a[1]).map(([cat, amt]: any) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(16,185,129,0.08)" }}>
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>{cat}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>+{thb(amt)}</span>
                  </div>
                ))}
              </div>
            )}

            {summary?.byCategory?.personal?.bySubCategory && Object.keys(summary.byCategory.personal.bySubCategory).length > 0 && (
              <div style={{ marginTop: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, padding: "14px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc", marginBottom: 10 }}>ส่วนตัว — หมวดย่อย</div>
                {Object.entries(summary.byCategory.personal.bySubCategory).sort((a:any,b:any)=>b[1]-a[1]).map(([sub, amt]: any) => {
                  const pct = amt / (summary.byCategory.personal.total || 1) * 100;
                  return (
                    <div key={sub} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 12, color: "#d1d5db" }}>{sub}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc" }}>{thb(amt)}</span>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div style={{ height: 3, background: "#6366f1", borderRadius: 2, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>}

          {/* ── Tab 2: Bar ── */}
          {tab === 2 && <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 16 }}>รายรับ vs รายจ่าย (6 เดือน)</div>
            {trend.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>ไม่มีข้อมูล</div> : <>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 4, height: 160, marginBottom: 8 }}>
                {trend.map((t, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", gap: 2 }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%", gap: 2 }}>
                      <div style={{ flex: 1, background: "rgba(16,185,129,0.6)", borderRadius: "3px 3px 0 0", height: `${((t.totalIncome||0) / barMax) * 100}%`, minHeight: (t.totalIncome||0) > 0 ? 3 : 0 }} />
                      <div style={{ flex: 1, background: "linear-gradient(to top,#6366f1,#8b5cf6)", borderRadius: "3px 3px 0 0", height: `${((t.totalExpense||0) / barMax) * 100}%`, minHeight: (t.totalExpense||0) > 0 ? 3 : 0 }} />
                    </div>
                    <div style={{ fontSize: 9, color: "#6b7280", textAlign: "center" }}>{shortMonth(t.month)}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} /><span style={{ fontSize: 11, color: "#9ca3af" }}>รายรับ</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#6366f1" }} /><span style={{ fontSize: 11, color: "#9ca3af" }}>รายจ่าย</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {trend.map((t, i) => {
                  const net = (t.totalIncome||0) - (t.totalExpense||0);
                  return (
                    <div key={i} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(t.month+"-01").toLocaleDateString("th-TH",{month:"long",year:"numeric"})}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: net >= 0 ? "#10b981" : "#ef4444" }}>{net >= 0 ? "+" : ""}{thb(net)}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#10b981" }}>รับ {thb(t.totalIncome||0)}</span>
                        <span style={{ fontSize: 11, color: "#ef4444" }}>จ่าย {thb(t.totalExpense||0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>}
          </>}

          {/* ── Tab 3: Budget ── */}
          {tab === 3 && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af" }}>งบประมาณเดือนนี้</div>
              <button onClick={() => setEditBudget(!editBudget)} style={{ padding: "6px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12 }}>
                {editBudget ? "ยกเลิก" : "ตั้งงบ"}
              </button>
            </div>
            {editBudget && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px", marginBottom: 14 }}>
                {cats.map(cat => (
                  <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: cat.color, flex: 1 }}>{cat.label}</div>
                    <input type="number" placeholder="0" value={budgets[cat.id] || ""}
                      onChange={e => setBudgets({...budgets,[cat.id]:parseFloat(e.target.value)||0})}
                      style={{ width: 100, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0", fontSize: 13, outline: "none", textAlign: "right" }} />
                  </div>
                ))}
                <button onClick={saveBudgets} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 600 }}>บันทึกงบ</button>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cats.map(cat => {
                const spent = summary?.byCategory?.[cat.id]?.total || 0;
                const budget = budgets[cat.id] || 0;
                const pct = budget > 0 ? Math.min(spent/budget*100, 100) : 0;
                const over = budget > 0 && spent > budget;
                const barColor = over ? "#ef4444" : pct > 75 ? "#f59e0b" : "#10b981";
                return (
                  <div key={cat.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cat.color }}>{cat.label}</div>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: over?"#ef4444":"#e8e8f0" }}>{thb(spent)}</span>
                        {budget > 0 && <span style={{ fontSize: 11, color: "#6b7280" }}> / {thb(budget)}</span>}
                      </div>
                    </div>
                    {budget > 0 ? <>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                        <div style={{ height: 6, background: barColor, borderRadius: 3, width: `${pct}%`, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: over?"#ef4444":"#6b7280" }}>{over?`เกินงบ ${thb(spent-budget)}`:`คงเหลือ ${thb(budget-spent)}`}</span>
                        <span style={{ fontSize: 10, color: "#6b7280" }}>{pct.toFixed(0)}%</span>
                      </div>
                    </> : <div style={{ fontSize: 11, color: "#4b5563" }}>ยังไม่ได้ตั้งงบ</div>}
                  </div>
                );
              })}
            </div>
          </>}

          {/* ── Tab 4: Trends ── */}
          {tab === 4 && <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 14 }}>แนวโน้ม 6 เดือนล่าสุด</div>
            {trend.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>ไม่มีข้อมูล</div> : <>
              {(() => {
                const vals = trend.map(t => (t.totalIncome||0) - (t.totalExpense||0));
                const max = Math.max(...vals.map(Math.abs), 1);
                const W = 300, H = 80, pad = 12;
                const midY = H / 2;
                const pts = vals.map((v, i) => `${pad + i * ((W-pad*2)/(vals.length-1))},${midY - (v/max)*(midY-pad)}`).join(" ");
                return (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px", marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 8 }}>กระแสเงินสุทธิ</div>
                    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                      <line x1={pad} y1={midY} x2={W-pad} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      <polyline points={pts} fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {vals.map((v, i) => (
                        <circle key={i} cx={pad + i * ((W-pad*2)/(vals.length-1))} cy={midY - (v/max)*(midY-pad)} r="3" fill={v >= 0 ? "#10b981" : "#ef4444"} />
                      ))}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      {trend.map((t, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#4b5563" }}>{shortMonth(t.month)}</div>)}
                    </div>
                  </div>
                );
              })()}

              {catTotals.map(cat => {
                const vals = trend.map(t => t.byCategory?.[cat.id]?.total || 0);
                const max = Math.max(...vals, 1);
                const W = 280, H = 55, pad = 10;
                const pts = vals.map((v, i) => `${pad + i * ((W-pad*2)/(vals.length-1))},${H - pad - (v/max)*(H-pad*2)}`).join(" ");
                return (
                  <div key={cat.id} style={{ background: `${cat.color}10`, border: `1px solid ${cat.color}25`, borderRadius: 14, padding: "14px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cat.color }}>{cat.label}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>รวม: {thb(cat.total)}</div>
                    </div>
                    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                      <polyline points={pts} fill="none" stroke={cat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {vals.map((v, i) => <circle key={i} cx={pad + i * ((W-pad*2)/(vals.length-1))} cy={H-pad-(v/max)*(H-pad*2)} r="3" fill={cat.color} />)}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      {trend.map((t, i) => <div key={i} style={{ flex: 1, fontSize: 9, color: "#4b5563", textAlign: "center" }}>{shortMonth(t.month)}</div>)}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      {vals.map((v, i) => <div key={i} style={{ flex: 1, fontSize: 9, color: v > 0 ? cat.color : "#374151", textAlign: "center", fontWeight: 600 }}>{v > 0 ? thb(v).replace("฿","") : "-"}</div>)}
                    </div>
                  </div>
                );
              })}

              {trend.length >= 2 && (() => {
                const last = trend[trend.length-1];
                const prev = trend[trend.length-2];
                const diff = (last.totalExpense||0) - (prev.totalExpense||0);
                const pct = prev.totalExpense > 0 ? (diff/prev.totalExpense*100).toFixed(1) : "0";
                const up = diff > 0;
                return (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>รายจ่าย: เดือนล่าสุด vs เดือนก่อน</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><div style={{ fontSize: 20, fontWeight: 800 }}>{thb(last.totalExpense||0)}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{shortMonth(last.month)}</div></div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, color: up?"#ef4444":"#10b981" }}>{up?"↑":"↓"}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: up?"#ef4444":"#10b981" }}>{up?"+":""}{pct}%</div>
                      </div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 800, color: "#6b7280" }}>{thb(prev.totalExpense||0)}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{shortMonth(prev.month)}</div></div>
                    </div>
                  </div>
                );
              })()}
            </>}
          </>}
        </>}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={() => setShowAdd(false)}>
          <div style={{ background: "#13131f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px", width: "100%", maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[["expense","รายจ่าย"],["income","รายรับ"]].map(([v,l]) => (
                <button key={v} onClick={() => setEntryType(v as any)}
                  style={{ flex: 1, padding: "9px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 600, background: entryType===v ? (v==="income"?"rgba(16,185,129,0.3)":"rgba(99,102,241,0.3)") : "rgba(255,255,255,0.05)", color: entryType===v ? (v==="income"?"#10b981":"#a5b4fc") : "#6b7280" }}>
                  {l}
                </button>
              ))}
            </div>

            {entryType === "expense" ? <>
              {[{label:"ร้านค้า *",key:"vendor",type:"text",ph:"ชื่อร้าน..."},{label:"จำนวน (THB) *",key:"amount",type:"number",ph:"0"},{label:"วันที่",key:"date",type:"date",ph:""},{label:"หมายเหตุ",key:"note",type:"text",ph:"รายละเอียด..."}].map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 5 }}>หมวด</label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {cats.map(cat => (
                    <button key={cat.id} onClick={() => setForm({...form,category:cat.id,sub_category:""})}
                      style={{ padding: "5px 11px", borderRadius: 10, border: "1px solid", fontSize: 12, background: form.category===cat.id?`${cat.color}25`:"transparent", borderColor: form.category===cat.id?cat.color:"rgba(255,255,255,0.1)", color: form.category===cat.id?cat.color:"#9ca3af" }}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              {form.category === "personal" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>หมวดย่อย</label>
                  <select value={form.sub_category} onChange={e => setForm({...form,sub_category:e.target.value})}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8f0", fontSize: 14, outline: "none" }}>
                    <option value="">-- เลือกหมวดย่อย --</option>
                    {PERSONAL_SUBS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </> : <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>ประเภทรายรับ</label>
                <select value={form.income_category} onChange={e => setForm({...form,income_category:e.target.value})}
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 10, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8f0", fontSize: 14, outline: "none" }}>
                  {INCOME_CATS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {[{label:"จำนวน (THB) *",key:"amount",type:"number",ph:"0"},{label:"วันที่",key:"date",type:"date",ph:""},{label:"หมายเหตุ",key:"note",type:"text",ph:"รายละเอียด..."}].map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </>}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 11, borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving || (!form.amount) || (entryType === "expense" && !form.vendor)}
                style={{ flex: 2, padding: 11, borderRadius: 11, border: "none", background: saving?"#4b5563":entryType==="income"?"linear-gradient(135deg,#10b981,#059669)":"linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 600, opacity: (!form.amount || (entryType === "expense" && !form.vendor)) ? 0.5 : 1 }}>
                {saving ? "กำลังบันทึก..." : entryType==="income" ? "บันทึกรายรับ" : "บันทึกรายจ่าย"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}