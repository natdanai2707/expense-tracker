import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const CATEGORIES = {
  personal:    { label: "ส่วนตัว",      color: "#6366f1" },
  with_layers: { label: "WITH LAYERS",   color: "#f59e0b" },
  met:         { label: "MET Furniture", color: "#10b981" },
  steel_s2000: { label: "S-2000",        color: "#ef4444" },
  south_steel: { label: "เหล็กใต้",      color: "#f97316" },
  other:       { label: "อื่นๆ",         color: "#8b5cf6" },
} as const;

export const INCOME_CATEGORIES = [
  "เงินเดือน",
  "รายรับจาก MET",
  "รายรับจาก With Layers",
  "เงินปันผล",
  "ค่าเช่า",
  "เงินคืนบัตรเครดิต",
  "รายรับจากอื่นๆ",
] as const;

export const PERSONAL_SUB_CATEGORIES = [
  "ค่าอาหาร","อาหารนอกบ้าน/คาเฟ่","ค่าที่พัก/สาธารณูปโภค","ค่าเดินทาง",
  "ค่ารักษาพยาบาล","ช้อปปิ้ง","สันทนาการ","ท่องเที่ยว","ของขวัญ","การออม/ลงทุน","อื่นๆ",
] as const;

export type CategoryId = keyof typeof CATEGORIES;
export type IncomeCategory = typeof INCOME_CATEGORIES[number];

export interface Expense {
  id?: string;
  date: string;
  vendor: string;
  amount: number;
  category: CategoryId;
  sub_category: string;
  note: string;
  added_by: string;
  line_user_id: string;
  group_id: string;
  type: "income" | "expense";
  income_category: string;
  created_at?: string;
}

export async function addExpense(expense: Omit<Expense, "id" | "created_at">) {
  const { data, error } = await supabase.from("expenses").insert([expense]).select().single();
  if (error) throw error;
  return data;
}

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const { data, error } = await supabase.from("expenses").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function getExpenses(options?: { category?: string; month?: string; group_id?: string; type?: string }) {
  let query = supabase.from("expenses").select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.category) query = query.eq("category", options.category);
  if (options?.month) query = query.gte("date", `${options.month}-01`).lte("date", `${options.month}-31`);
  if (options?.group_id) query = query.eq("group_id", options.group_id);
  if (options?.type) query = query.eq("type", options.type);

  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
}

export async function getMonthlySummary(month?: string, group_id?: string) {
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const expenses = await getExpenses({ month: targetMonth, group_id });

  const summary = {
    month: targetMonth,
    totalExpense: 0,
    totalIncome: 0,
    net: 0,
    count: expenses.length,
    byCategory: {} as Record<string, { total: number; count: number; label: string; color: string; bySubCategory: Record<string, number> }>,
    byIncomeCategory: {} as Record<string, number>,
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
      if (summary.byCategory[e.category]) {
        summary.byCategory[e.category].total += e.amount;
        summary.byCategory[e.category].count += 1;
        if (e.sub_category) {
          summary.byCategory[e.category].bySubCategory[e.sub_category] =
            (summary.byCategory[e.category].bySubCategory[e.sub_category] || 0) + e.amount;
        }
      }
    }
  }

  summary.net = summary.totalIncome - summary.totalExpense;
  return summary;
}

export function formatTHB(n: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
}