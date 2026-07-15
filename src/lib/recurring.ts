import { supabase } from "./supabase";
import { addExpense } from "./supabase";
import { currentMonth, todayISO } from "./dates";
import type { EntryType } from "./types";

export interface RecurringRule {
  id?: string;
  group_id: string;
  day_of_month: number;
  type: EntryType;
  vendor: string;
  amount: number;
  category: string;
  sub_category: string;
  income_category: string;
  note: string;
  active: boolean;
  last_run?: string | null;
}

export async function listRecurring(groupId: string): Promise<RecurringRule[]> {
  const { data, error } = await supabase.from("recurring_transactions").select("*").eq("group_id", groupId).order("day_of_month");
  if (error) throw error;
  return (data ?? []) as RecurringRule[];
}

export async function createRecurring(rule: Omit<RecurringRule, "id" | "last_run">): Promise<RecurringRule> {
  const { data, error } = await supabase.from("recurring_transactions").insert([rule]).select().single();
  if (error) throw error;
  return data as RecurringRule;
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Materialize all active recurring rules that are due this month and haven't
 * run yet. Idempotent: a rule whose last_run is in the current month is skipped,
 * so re-running (e.g. a retried cron) never double-posts.
 */
export async function runDueRecurring(): Promise<{ created: number }> {
  const month = currentMonth();
  const { data, error } = await supabase.from("recurring_transactions").select("*").eq("active", true);
  if (error) throw error;

  let created = 0;
  for (const rule of (data ?? []) as RecurringRule[]) {
    if (rule.last_run && rule.last_run.slice(0, 7) >= month) continue; // already ran this month
    const day = Math.min(Math.max(1, rule.day_of_month || 1), 28);
    const date = `${month}-${String(day).padStart(2, "0")}`;
    await addExpense({
      date,
      vendor: rule.vendor,
      amount: rule.amount,
      category: rule.category || "other",
      sub_category: rule.sub_category || "",
      note: rule.note ? `${rule.note} (อัตโนมัติ)` : "รายการอัตโนมัติ",
      added_by: "Auto",
      line_user_id: "recurring",
      group_id: rule.group_id,
      type: rule.type || "expense",
      income_category: rule.income_category || "",
    });
    await supabase.from("recurring_transactions").update({ last_run: todayISO() }).eq("id", rule.id);
    created += 1;
  }
  return { created };
}
