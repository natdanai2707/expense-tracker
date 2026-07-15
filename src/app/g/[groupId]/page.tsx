"use client";
import { useMemo, useRef, useState, use } from "react";
import { monthLabel, thb } from "@/lib/format";
import { addMonths, currentMonth } from "@/lib/dates";
import type { Expense } from "@/lib/types";
import { useDashboard } from "./useDashboard";
import { DashboardSkeleton } from "./components/Skeletons";
import { SummaryRow, MonthNav, Segmented } from "./components/ui";
import { ExpenseList } from "./components/ExpenseList";
import { SearchFilter, type Filters } from "./components/SearchFilter";
import { PieTab } from "./components/PieTab";
import { BarTab } from "./components/BarTab";
import { BudgetTab } from "./components/BudgetTab";
import { TrendsTab } from "./components/TrendsTab";
import { DailyTab } from "./components/DailyTab";
import { BusinessTab } from "./components/BusinessTab";
import { AddModal, type NewEntry } from "./components/AddModal";
import { RecurringModal } from "./components/RecurringModal";
import { Toast, type ToastData } from "./components/Toast";

const TABS = ["รายการ", "รายวัน", "Pie", "Bar", "Budget", "Trends", "ธุรกิจ"];
const MONTH_TABS = new Set([0, 1, 2, 4, 6]); // tabs where the month selector applies

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [month, setMonth] = useState(currentMonth);
  const { data, loading, error, revalidate, mutate, invalidate } = useDashboard(groupId, month);

  const [tab, setTab] = useState(0);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [catFilter, setCatFilter] = useState("all");
  const [filters, setFilters] = useState<Filters>({ q: "", min: "", max: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const cats = data?.config.cats ?? [];
  const groupName = data?.config.name ?? "กลุ่มของฉัน";
  const summary = data?.summary;
  const expenses = data?.expenses ?? [];

  const showToast = (t: ToastData, ms = 4000) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), ms);
  };

  // ── Filtered list (type + category + search) ──
  const filtered = useMemo(() => {
    const min = parseFloat(filters.min);
    const max = parseFloat(filters.max);
    const q = filters.q.trim().toLowerCase();
    return expenses.filter((e) => {
      if (typeFilter === "income" && e.type !== "income") return false;
      if (typeFilter === "expense" && e.type === "income") return false;
      if (catFilter !== "all" && e.category !== catFilter) return false;
      if (Number.isFinite(min) && e.amount < min) return false;
      if (Number.isFinite(max) && e.amount > max) return false;
      if (q && !`${e.vendor} ${e.note} ${e.sub_category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [expenses, typeFilter, catFilter, filters]);

  // ── Mutations (optimistic) ──
  const addEntry = async (entry: NewEntry) => {
    const amount = parseFloat(entry.amount) || 0;
    const optimistic: Expense = {
      id: `temp-${Date.now()}`,
      date: entry.date, vendor: entry.type === "income" ? entry.income_category : entry.vendor,
      amount, category: entry.type === "income" ? "other" : entry.category,
      sub_category: entry.sub_category, note: entry.note, added_by: "Web", line_user_id: "web",
      group_id: groupId, type: entry.type, income_category: entry.type === "income" ? entry.income_category : "",
    };
    mutate((list) => [optimistic, ...list]);
    setShowAdd(false);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...optimistic, amount }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ");
      revalidate();
    } catch (e) {
      mutate((list) => list.filter((x) => x.id !== optimistic.id));
      showToast({ message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ", tone: "error" });
    }
  };

  const saveEdit = async (id: string, patch: Partial<Expense>) => {
    setEditingId(null);
    const before = expenses.find((e) => e.id === id);
    mutate((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "แก้ไขไม่สำเร็จ");
      revalidate();
    } catch (e) {
      if (before) mutate((list) => list.map((x) => (x.id === id ? before : x)));
      showToast({ message: e instanceof Error ? e.message : "แก้ไขไม่สำเร็จ", tone: "error" });
    }
  };

  // Deferred delete: remove from UI now, actually DELETE after the undo window.
  const deleteItem = (id: string) => {
    setEditingId(null);
    const removed = expenses.find((e) => e.id === id);
    if (!removed) return;
    mutate((list) => list.filter((e) => e.id !== id));

    const timer = setTimeout(async () => {
      deleteTimers.current.delete(id);
      try {
        const res = await fetch("/api/expenses", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error();
        revalidate();
      } catch {
        mutate((list) => [removed, ...list]);
        showToast({ message: "ลบไม่สำเร็จ กู้คืนแล้ว", tone: "error" });
      }
    }, 4500);
    deleteTimers.current.set(id, timer);

    showToast({
      message: `ลบ "${removed.vendor}" แล้ว`,
      action: {
        label: "เลิกทำ",
        onClick: () => {
          const t = deleteTimers.current.get(id);
          if (t) { clearTimeout(t); deleteTimers.current.delete(id); }
          mutate((list) => (list.some((x) => x.id === id) ? list : [removed, ...list].sort((a, b) => (a.date < b.date ? 1 : -1))));
        },
      },
    }, 4300);
  };

  const saveBudgets = async (budgets: Record<string, number>) => {
    try {
      const res = await fetch(`/api/group-config/${groupId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets }),
      });
      if (!res.ok) throw new Error();
      invalidate();
      revalidate();
      showToast({ message: "บันทึกงบแล้ว" });
    } catch {
      showToast({ message: "บันทึกงบไม่สำเร็จ", tone: "error" });
    }
  };

  const shiftMonth = (n: number) => setMonth((m) => addMonths(m, n));

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-from to-accent-to text-base">💳</div>
            <div>
              <div className="text-sm font-bold">{groupName}</div>
              <div className="text-[10px] text-ink-faint">Expense Tracker</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRecurring(true)} className="rounded-pill border border-white/10 px-3 py-2 text-xs text-ink-muted" title="รายการอัตโนมัติ">🔁</button>
            <a href={`/api/export/${groupId}?month=${month}`} className="rounded-pill border border-white/10 px-3 py-2 text-xs text-ink-muted" title="ส่งออก CSV">⇩ CSV</a>
            <button onClick={() => setShowAdd(true)} className="btn-accent px-4 py-2 text-[13px]">+ เพิ่ม</button>
          </div>
        </div>

        {MONTH_TABS.has(tab) && <MonthNav label={monthLabel(month)} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />}

        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`whitespace-nowrap rounded-t-[10px] border-b-2 px-4 py-2 text-[13px] ${tab === i ? "border-accent bg-accent/20 font-bold text-accent-soft" : "border-transparent text-ink-faint"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="h-px bg-line" />
      </div>

      {/* Body */}
      <div className="px-4 pb-28 pt-4">
        {error && !data && (
          <div className="mb-3 rounded-card border border-expense/30 bg-expense/10 px-4 py-3 text-sm text-expense">
            {error} · <button onClick={revalidate} className="underline">ลองใหม่</button>
          </div>
        )}

        {loading || !data || !summary ? <DashboardSkeleton /> : (
          <>
            {tab === 0 && (
              <>
                <SummaryRow income={summary.totalIncome} expense={summary.totalExpense} net={summary.net} />
                <div className="mb-2.5"><Segmented options={[["all", "ทั้งหมด"], ["income", "รายรับ"], ["expense", "รายจ่าย"]]} value={typeFilter} onChange={setTypeFilter} /></div>
                <SearchFilter filters={filters} onChange={setFilters} cats={cats} catFilter={catFilter} onCatFilter={setCatFilter} />

                {typeFilter !== "income" && (
                  <div className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto pb-2">
                    {cats.map((cat) => {
                      const total = summary.byCategory[cat.id]?.total || 0;
                      const active = catFilter === cat.id;
                      return (
                        <div key={cat.id} onClick={() => setCatFilter(active ? "all" : cat.id)}
                          className="min-w-[110px] shrink-0 cursor-pointer rounded-card border-2 px-3 py-2.5"
                          style={{ background: `${cat.color}15`, borderColor: active ? cat.color : `${cat.color}30` }}>
                          <div className="mb-1 text-[10px] text-ink-muted">{cat.label}</div>
                          <div className="text-[15px] font-bold tabular-nums" style={{ color: cat.color }}>{thb(total)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <ExpenseList items={filtered} cats={cats} editingId={editingId}
                  onEdit={(it) => setEditingId(it.id!)} onSaveEdit={saveEdit} onDelete={deleteItem} onCancelEdit={() => setEditingId(null)} />
              </>
            )}

            {tab === 1 && <DailyTab month={month} daily={data.daily} expenses={expenses} />}
            {tab === 2 && <PieTab summary={summary} cats={cats} />}
            {tab === 3 && <BarTab trend={data.trend} />}
            {tab === 4 && <BudgetTab summary={summary} cats={cats} budgets={data.config.budgets} onSave={saveBudgets} />}
            {tab === 5 && <TrendsTab trend={data.trend} cats={cats} />}
            {tab === 6 && <BusinessTab summary={summary} enabledCategories={data.config.categories} />}
          </>
        )}
      </div>

      {showAdd && <AddModal cats={cats} onClose={() => setShowAdd(false)} onSubmit={addEntry} />}
      {showRecurring && <RecurringModal groupId={groupId} cats={cats} onClose={() => setShowRecurring(false)} onError={(m) => showToast({ message: m, tone: "error" })} />}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
