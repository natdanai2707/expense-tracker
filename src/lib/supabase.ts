import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const CATEGORIES = {
  personal:    { label: "ส่วนตัว",          emoji: "👤", color: "#6366f1" },
  with_layers: { label: "WITH LAYERS",       emoji: "🖊️", color: "#f59e0b" },
  met:         { label: "MET Furniture",     emoji: "🪑", color: "#10b981" },
  steel:       { label: "เหล็กใต้ / S-2000", emoji: "⚙️", color: "#ef4444" },
  other:       { label: "อื่นๆ",             emoji: "📦", color: "#8b5cf6" },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export interface Expense {
  id?: string;
  date: string;
  vendor: string;
  amount: number;
  category: CategoryId;
  note: string;
  added_by: string;
  line_user_id: string;
  created_at?: string;
}

export async function addExpense(expense: Omit<Expense, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("expenses")
    .insert([expense])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getExpenses(options?: {
  category?: string;
  month?: string;
}) {
  let query = supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.category) {
    query = query.eq("category", options.category);
  }

  if (options?.month) {
    const start = `${options.month}-01`;
    const end = `${options.month}-31`;
    query = query.gte("date", start).lte("date", end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
}

export async function getMonthlySummary(month?: string) {
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const expenses = await getExpenses({ month: targetMonth });

  const summary = {
    month: targetMonth,
    total: 0,
    count: expenses.length,
    byCategory: {} as Record<string, { total: number; count: number; label: string; emoji: string; color: string }>,
  };

  for (const [id, cat] of Object.entries(CATEGORIES)) {
    summary.byCategory[id] = { total: 0, count: 0, ...cat };
  }

  for (const e of expenses) {
    summary.total += e.amount;
    if (summary.byCategory[e.category]) {
      summary.byCategory[e.category].total += e.amount;
      summary.byCategory[e.category].count += 1;
    }
  }

  return summary;
}

export function formatTHB(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency", currency: "THB", maximumFractionDigits: 0,
  }).format(n);
}
