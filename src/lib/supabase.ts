import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, DEFAULT_CATEGORIES, DEFAULT_GROUP_NAME, categoryMeta } from "./constants";
import { monthRange, recentMonths, daysOfMonth, currentMonth } from "./dates";
import type {
  Expense, MonthlySummary, TrendPoint, DayTotal,
  GroupConfig, GroupConfigResponse, DashboardData,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  // Fail loudly at import time rather than with an opaque runtime fetch error.
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars");
}

export const supabase = createClient(url, anon);

// Re-export shared constants so existing imports keep working.
export { CATEGORIES } from "./constants";
export type { CategoryId } from "./constants";
export { thb as formatTHB } from "./format";
export type { Expense } from "./types";

// ── Queries ──────────────────────────────────────────────────

export async function addExpense(expense: Omit<Expense, "id" | "created_at">) {
  const { data, error } = await supabase.from("expenses").insert([expense]).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const { data, error } = await supabase.from("expenses").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export interface ExpenseQuery {
  month?: string;
  category?: string;
  group_id?: string;
  type?: string;
}

export async function getExpenses(options?: ExpenseQuery): Promise<Expense[]> {
  let query = supabase.from("expenses").select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.category) query = query.eq("category", options.category);
  if (options?.month) {
    // Real calendar range, exclusive upper bound — never "-31".
    const { start, endExclusive } = monthRange(options.month);
    query = query.gte("date", start).lt("date", endExclusive);
  }
  if (options?.group_id) query = query.eq("group_id", options.group_id);
  if (options?.type) query = query.eq("type", options.type);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Expense[];
}

/** Pure aggregation over an already-fetched expense list. */
export function summarize(month: string, expenses: Expense[]): MonthlySummary {
  const summary: MonthlySummary = {
    month,
    totalExpense: 0,
    totalIncome: 0,
    net: 0,
    count: expenses.length,
    byCategory: {},
    byIncomeCategory: {},
  };

  for (const [id, cat] of Object.entries(CATEGORIES)) {
    summary.byCategory[id] = { total: 0, count: 0, ...cat, bySubCategory: {} };
  }

  for (const e of expenses) {
    if (e.type === "income") {
      summary.totalIncome += e.amount;
      const key = e.income_category || "รายรับจากอื่นๆ";
      summary.byIncomeCategory[key] = (summary.byIncomeCategory[key] || 0) + e.amount;
    } else {
      summary.totalExpense += e.amount;
      if (!summary.byCategory[e.category]) {
        summary.byCategory[e.category] = { total: 0, count: 0, ...categoryMeta(e.category), bySubCategory: {} };
      }
      const bucket = summary.byCategory[e.category];
      bucket.total += e.amount;
      bucket.count += 1;
      if (e.sub_category) {
        bucket.bySubCategory[e.sub_category] = (bucket.bySubCategory[e.sub_category] || 0) + e.amount;
      }
    }
  }

  summary.net = summary.totalIncome - summary.totalExpense;
  return summary;
}

export async function getMonthlySummary(month?: string, group_id?: string): Promise<MonthlySummary> {
  const targetMonth = month || currentMonth();
  const expenses = await getExpenses({ month: targetMonth, group_id });
  return summarize(targetMonth, expenses);
}

/** Per-day totals for a month (daily / calendar heatmap view). */
export function dailyTotals(month: string, expenses: Expense[]): DayTotal[] {
  const byDate = new Map<string, DayTotal>();
  for (const day of daysOfMonth(month)) byDate.set(day, { date: day, expense: 0, income: 0, count: 0 });
  for (const e of expenses) {
    const key = (e.date || "").slice(0, 10);
    const d = byDate.get(key);
    if (!d) continue;
    if (e.type === "income") d.income += e.amount;
    else d.expense += e.amount;
    d.count += 1;
  }
  return [...byDate.values()];
}

// ── Group config ─────────────────────────────────────────────

export async function getGroupConfig(groupId: string): Promise<GroupConfigResponse> {
  const { data } = await supabase.from("group_config").select("*").eq("group_id", groupId).maybeSingle();
  const config: GroupConfig = data
    ? { group_id: data.group_id, name: data.name || DEFAULT_GROUP_NAME, categories: data.categories || DEFAULT_CATEGORIES, budgets: data.budgets || {} }
    : { group_id: groupId, name: DEFAULT_GROUP_NAME, categories: [...DEFAULT_CATEGORIES], budgets: {} };
  const cats = config.categories.map((id) => ({ id, ...categoryMeta(id) }));
  return { ...config, cats };
}

export async function getGroupCategories(groupId: string): Promise<string[]> {
  const { data } = await supabase.from("group_config").select("categories").eq("group_id", groupId).maybeSingle();
  return data?.categories || [...DEFAULT_CATEGORIES];
}

export async function ensureGroupConfig(groupId: string): Promise<void> {
  const { data } = await supabase.from("group_config").select("group_id").eq("group_id", groupId).maybeSingle();
  if (!data) {
    await supabase.from("group_config").insert({ group_id: groupId, name: DEFAULT_GROUP_NAME, categories: DEFAULT_CATEGORIES });
  }
}

// ── Consolidated dashboard (one round-trip for the whole page) ──

export async function getDashboard(month: string, groupId: string, trendMonths = 6): Promise<DashboardData> {
  const months = recentMonths(month, trendMonths);
  const rangeStart = monthRange(months[0]).start;
  const rangeEnd = monthRange(month).endExclusive;

  // Pull the whole trend window in ONE query, then aggregate in memory.
  const { data, error } = await supabase.from("expenses").select("*")
    .eq("group_id", groupId)
    .gte("date", rangeStart)
    .lt("date", rangeEnd)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const all = (data ?? []) as Expense[];
  const inMonth = (e: Expense) => {
    const { start, endExclusive } = monthRange(month);
    return e.date >= start && e.date < endExclusive;
  };
  const monthExpenses = all.filter(inMonth);

  const config = await getGroupConfig(groupId);

  const trend: TrendPoint[] = months.map((m) => {
    const { start, endExclusive } = monthRange(m);
    const rows = all.filter((e) => e.date >= start && e.date < endExclusive);
    const { month: _m, ...rest } = summarize(m, rows);
    return { month: m, ...rest };
  });

  return {
    month,
    expenses: monthExpenses,
    summary: summarize(month, monthExpenses),
    trend,
    daily: dailyTotals(month, monthExpenses),
    config,
  };
}
