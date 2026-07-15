import type { CategoryId } from "./constants";

export type EntryType = "income" | "expense";

export interface Expense {
  id?: string;
  date: string;                 // YYYY-MM-DD
  vendor: string;
  amount: number;
  category: CategoryId | string;
  sub_category: string;
  note: string;
  added_by: string;
  line_user_id: string;
  group_id: string;
  type: EntryType;
  income_category: string;
  receipt_url?: string | null;
  created_at?: string;
}

/** Result of parsing a text message or a receipt OCR. */
export interface ParsedExpense {
  vendor: string;
  amount: number;
  category: CategoryId;
  sub_category: string;
  note: string;
  date?: string;
  type: EntryType;
  income_category: string;
}

export interface CategorySummary {
  total: number;
  count: number;
  label: string;
  color: string;
  bySubCategory: Record<string, number>;
}

export interface MonthlySummary {
  month: string;
  totalExpense: number;
  totalIncome: number;
  net: number;
  count: number;
  byCategory: Record<string, CategorySummary>;
  byIncomeCategory: Record<string, number>;
}

/** One month in a trend series (summary minus the `month` field folded in). */
export interface TrendPoint extends Omit<MonthlySummary, "month"> {
  month: string;
}

/** Spend total for a single calendar day (daily/heatmap view). */
export interface DayTotal {
  date: string;      // YYYY-MM-DD
  expense: number;
  income: number;
  count: number;
}

export interface GroupConfig {
  group_id: string;
  name: string;
  categories: string[];
  budgets: Record<string, number>;
}

export interface GroupConfigResponse extends GroupConfig {
  cats: { id: string; label: string; color: string }[];
}

/** Consolidated dashboard payload — one round-trip for the whole page. */
export interface DashboardData {
  month: string;
  expenses: Expense[];
  summary: MonthlySummary;
  trend: TrendPoint[];
  daily: DayTotal[];
  config: GroupConfigResponse;
}
