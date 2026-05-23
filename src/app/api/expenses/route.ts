import { NextRequest, NextResponse } from "next/server";
import { getExpenses, getMonthlySummary, addExpense, updateExpense, supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "list";
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const category = searchParams.get("category") || undefined;
  const group_id = searchParams.get("group_id") || "default";
  const months = parseInt(searchParams.get("months") || "6");

  try {
    if (type === "summary") return NextResponse.json(await getMonthlySummary(month, group_id));

    if (type === "monthly_trend") {
      const results = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const m = d.toISOString().slice(0, 7);
        const summary = await getMonthlySummary(m, group_id);
        const { month: _m, ...summaryRest } = summary;
        results.push({ month: m, ...summaryRest });
      }
      return NextResponse.json(results);
    }

    return NextResponse.json(await getExpenses({ month, category, group_id }));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  await addExpense({
    vendor: b.vendor, amount: parseFloat(b.amount),
    category: b.category, sub_category: b.sub_category || "",
    note: b.note || "", added_by: b.added_by || "Web",
    line_user_id: "web",
    date: b.date || new Date().toISOString().split("T")[0],
    group_id: b.group_id || "default",
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json();
  await updateExpense(id, updates);
  return NextResponse.json({ ok: true });
}